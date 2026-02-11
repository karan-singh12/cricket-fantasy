const mongoose = require("mongoose");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const Notification = require("../../models/Notification");
const apiResponse = require("../../utils/apiResponse");
const { generateReferralCode } = require("../../utils/functions");
const { USER, ERROR, SUCCESS, ADMIN } = require("../../utils/responseMsg");

const userController = {
  async addUser(req, res) {
    try {
      const {
        name,
        email,
        phone,
        dob,
        metadata = {},
        isBot = false,
      } = req.body;

      if (email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return apiResponse.ErrorResponse(res, ADMIN.emailExists);
        }
      }

      if (phone) {
        const phoneExists = await User.findOne({ phone });
        if (phoneExists) {
          return apiResponse.ErrorResponse(res, USER.phoneExists);
        }
      }

      const newUser = new User({
        name,
        email,
        phone,
        dob,
        metadata,
        status: 1,
        is_bot: isBot,
      });

      await newUser.save();

      // Initialize wallet for the new user if not bot
      if (!isBot) {
        const newWallet = new Wallet({
          user: newUser._id,
          balance: 0,
        });
        await newWallet.save();
      }

      return apiResponse.successResponseWithData(res, USER.userAdded, newUser);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllUser(req, res) {
    try {
      let {
        pageSize,
        pageNumber,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "desc",
        status = [],
      } = req.body;

      const filter = { status: { $ne: 2 }, is_bot: false };

      if (status.length > 0) {
        filter.status = { $in: status };
      }

      if (searchItem) {
        filter.$or = [
          { name: { $regex: searchItem, $options: "i" } },
          { email: { $regex: searchItem, $options: "i" } },
          { phone: { $regex: searchItem, $options: "i" } },
        ];
      }

      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;

      if (shouldPaginate) {
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const skip = (pageNumber - 1) * pageSize;

        const totalRecords = await User.countDocuments(filter);
        const result = await User.find(filter)
          .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
          .skip(skip)
          .limit(pageSize)
          .lean();

        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          result,
          totalRecords,
          pageNumber,
          pageSize,
          paginated: true,
        });
      } else {
        const result = await User.find(filter)
          .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
          .lean();

        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          result,
          totalRecords: result.length,
          paginated: false,
        });
      }
    } catch (error) {
      console.error("Error in getAllUser:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneUser(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return apiResponse.ErrorResponse(res, "Invalid ID format");
      }

      const user = await User.findById(id).lean();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, user);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateUser(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { id, imagePath, ...updateFields } = req.body;

      if (req.file) {
        updateFields.image_url = req.file.path.replace(/\\/g, "/");
      }

      const currentUser = await User.findById(id).session(session);
      if (!currentUser) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      if (updateFields.email && updateFields.email !== currentUser.email) {
        const emailExists = await User.findOne({ email: updateFields.email, _id: { $ne: id } }).session(session);
        if (emailExists) {
          await session.abortTransaction();
          session.endSession();
          return apiResponse.ErrorResponse(res, ADMIN.emailExists);
        }
      }

      if (updateFields.phone && updateFields.phone !== currentUser.phone) {
        const phoneExists = await User.findOne({ phone: updateFields.phone, _id: { $ne: id } }).session(session);
        if (phoneExists) {
          await session.abortTransaction();
          session.endSession();
          return apiResponse.ErrorResponse(res, USER.phoneNumberExists);
        }
      }

      let walletUpdated = false;
      let referralBonusUpdated = false;
      let newBalance = null;
      let newBonus = null;

      if (updateFields.wallet_balance !== undefined) {
        newBalance = Number(updateFields.wallet_balance);
        currentUser.wallet_balance = newBalance;

        await Wallet.findOneAndUpdate(
          { user: id },
          { balance: newBalance },
          { session, upsert: true }
        );
        walletUpdated = true;
        delete updateFields.wallet_balance;
      }

      if (updateFields.referral_bonus !== undefined) {
        newBonus = Number(updateFields.referral_bonus);
        currentUser.referral_bonus = newBonus;
        referralBonusUpdated = true;
        delete updateFields.referral_bonus;
      }

      // Update remaining fields
      Object.assign(currentUser, updateFields);
      const updatedUser = await currentUser.save({ session });

      // Notifications
      if (walletUpdated) {
        await new Notification({
          user: id,
          title: "Wallet Updated by Admin",
          content: `Your wallet balance has been updated to ৳${newBalance}`,
          is_read: false,
        }).save({ session });
      }

      if (referralBonusUpdated) {
        await new Notification({
          user: id,
          title: "Referral Bonus Updated",
          content: `Your referral bonus has been updated to ৳${newBonus}`,
          is_read: false,
        }).save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return apiResponse.successResponseWithData(
        res,
        USER.userUpdated,
        updatedUser
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (![0, 1, 2].includes(status)) {
        return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
      }

      const updated = await User.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        USER.statusUpdated,
        updated
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.body;

      const updated = await User.findByIdAndUpdate(
        id,
        { status: 2 },
        { new: true }
      );

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotDeleted);
      }

      return apiResponse.successResponseWithData(
        res,
        USER.userMarkedAsDeleted,
        updated
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async addReferralCode(req, res) {
    try {
      const { userId, bonus = 0 } = req.body;

      if (!userId) {
        return apiResponse.ErrorResponse(res, USER.userIDrequired);
      }

      const user = await User.findById(userId);
      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      let referralCode;
      let exists = true;
      while (exists) {
        referralCode = generateReferralCode();
        const codeExists = await User.findOne({ referral_code: referralCode });
        exists = !!codeExists;
      }

      user.referral_code = referralCode;
      user.referral_bonus = bonus;
      await user.save();

      await new Notification({
        user: userId,
        title: "Referral Code Generated",
        content: `Your referral code ${referralCode} has been generated successfully. got a bonus of ৳${bonus}.`,
        is_read: false,
      }).save();

      return apiResponse.successResponseWithData(
        res,
        USER.referralCodeAdded,
        user
      );
    } catch (error) {
      console.error("Error in addReferralCode:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = userController;
