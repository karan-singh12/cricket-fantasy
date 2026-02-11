const User = require("../../models/User");
const apiResponse = require("../../utils/apiResponse");
const { USER, ERROR, SUCCESS, ADMIN } = require("../../utils/responseMsg");

const botUserController = {
  async addBotUser(req, res) {
    try {
      const { name, email, phone, dob, metadata = {} } = req.body;

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

      const newUser = await User.create({
        name,
        email,
        phone,
        dob,
        metadata,
        status: 1,
        is_bot: true,
      });

      return apiResponse.successResponseWithData(res, USER.userAdded, newUser);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllBotUser(req, res) {
    try {
      let {
        pageSize,
        pageNumber,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "desc",
        status = [],
      } = req.body;

      let filter = { is_bot: true, status: { $ne: 2 } };

      if (status.length > 0) {
        filter.status = { $in: status.map(Number) };
      }

      if (searchItem) {
        filter.$or = [
          { name: { $regex: searchItem, $options: "i" } },
          { email: { $regex: searchItem, $options: "i" } },
          { phone: { $regex: searchItem, $options: "i" } },
        ];
      }

      const totalRecords = await User.countDocuments(filter);

      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;
      let query = User.find(filter)
        .select(
          "name email phone status dob is_verified is_name_setup referral_code referred_by social_login_type fb_id google_id apple_id device_id device_type metadata created_at referral_bonus"
        )
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 });

      if (shouldPaginate) {
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const skip = (pageNumber - 1) * pageSize;
        query = query.skip(skip).limit(pageSize);
      }

      const result = await query.lean();

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: result.map(u => ({ ...u, id: u._id })),
        totalRecords,
        pageNumber: shouldPaginate ? pageNumber : 1,
        pageSize: shouldPaginate ? pageSize : result.length,
        paginated: shouldPaginate,
      });
    } catch (error) {
      console.error("Error in getAllBotUser:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneBotUser(req, res) {
    try {
      const { id } = req.params;
      const user = await User.findById(id).lean();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, { ...user, id: user._id });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateBotUser(req, res) {
    try {
      const { id, ...updateFields } = req.body;

      if (req.file) {
        updateFields.image_url = req.file.path.replace(/\\/g, "/");
      }

      const currentUser = await User.findById(id);
      if (!currentUser) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      if (updateFields.email && updateFields.email !== currentUser.email) {
        const emailExists = await User.findOne({ email: updateFields.email, _id: { $ne: id } });
        if (emailExists) {
          return apiResponse.ErrorResponse(res, ADMIN.emailExists);
        }
      }

      if (updateFields.phone && updateFields.phone !== currentUser.phone) {
        const phoneExists = await User.findOne({ phone: updateFields.phone, _id: { $ne: id } });
        if (phoneExists) {
          return apiResponse.ErrorResponse(res, USER.phoneNumberExists);
        }
      }

      const updated = await User.findByIdAndUpdate(id, updateFields, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(res, USER.userUpdated, { ...updated, id: updated._id });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (![0, 1, 2].includes(Number(status))) {
        return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
      }

      const updated = await User.findByIdAndUpdate(id, { status: Number(status) }, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(res, USER.statusUpdated, { ...updated, id: updated._id });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteBotUser(req, res) {
    try {
      const { id } = req.body;

      const updated = await User.findByIdAndUpdate(id, { status: 2 }, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotDeleted);
      }

      return apiResponse.successResponseWithData(res, USER.userMarkedAsDeleted, { ...updated, id: updated._id });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = botUserController;
