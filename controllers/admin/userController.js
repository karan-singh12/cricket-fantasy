const { knex: db } = require("../../config/database");
const config = require("../../config/config");
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator, generateReferralCode } = require("../../utils/functions");
const { USER, ERROR, SUCCESS, ADMIN } = require("../../utils/responseMsg");

const userController = {
  async addUser(req, res) {
    try {
      const {
        name,
        email,
        phone,
        dob,
        referral_code,
        metadata = {},
      } = req.body;

      if (email) {
        const emailExists = await db("users").where("email", email).first();

        if (emailExists) {
          return apiResponse.ErrorResponse(res, ADMIN.emailExists);
        }
      }

      if (phone) {
        const phoneExists = await db("users")
          .where("phone", phone)

          .first();

        if (phoneExists) {
          return apiResponse.ErrorResponse(res, USER.phoneExists);
        }
      }

      const [newUser] = await db("users")
        .insert({
          name,
          email,
          phone,
          dob,
          metadata,
          status: 1,
          is_bot: false, // Defaulting to false as this is public addUser
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");
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

      let query = db("users").whereNot("status", 2).andWhere("is_bot", false);

      // Filter by status if provided
      if (status.length > 0) {
        query.andWhere((qb) => qb.whereIn("status", status));
      }

      // Search functionality
      if (searchItem) {
        query.andWhere((builder) =>
          builder
            .whereILike("name", `%${searchItem}%`)
            .orWhereILike("email", `%${searchItem}%`)
            .orWhereILike("phone", `%${searchItem}%`)
        );
      }

      // Check if pagination parameters are provided
      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;

      if (shouldPaginate) {
        // Handle pagination
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const pageOffset = Math.max(0, pageNumber - 1);

        // Get total count
        const totalRecords = await query.clone().count().first();

        // Get paginated results
        const result = await query
          .select(
            "id",
            "name",
            "email",
            "phone",
            "status",
            "dob",
            "is_verified",
            "is_name_setup",
            "referral_code",
            "referred_by",
            "social_login_type",
            "fb_id",
            "google_id",
            "apple_id",
            "is_bot",
            "device_id",
            "device_type",
            "metadata",
            "created_at",
            "referral_bonus"
          )
          .orderBy(sortBy, sortOrder)
          .limit(pageSize)
          .offset(pageSize * pageOffset);

        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          result,
          totalRecords: parseInt(totalRecords.count),
          pageNumber: pageNumber,
          pageSize,
          paginated: true,
        });
      } else {
        // Return all records when no pagination parameters are provided
        const result = await query
          .select(
            "id",
            "name",
            "email",
            "phone",
            "status",
            "dob",
            "is_verified",
            "is_name_setup",
            "referral_code",
            "referred_by",
            "social_login_type",
            "fb_id",

            "is_bot",
            "google_id",
            "apple_id",
            "device_id",
            "device_type",
            "metadata",
            "created_at"
          )
          .orderBy(sortBy, sortOrder);

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

      const user = await db("users").where({ id }).select("*").first();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, user);
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateUser(req, res) {
    try {
      const { id, imagePath, ...updateFields } = req.body;
      console.log(req.body);

      updateFields.updated_at = db.fn.now();

      if (req.file) {
        updateFields.image_url = req.file.path.replace(/\\/g, "/");
      }

      const currentUser = await db("users").where({ id }).first();
      if (!currentUser) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      if (updateFields.email && updateFields.email !== currentUser.email) {
        const emailExists = await db("users")
          .where("email", updateFields.email)
          .whereNot("id", id)
          .first();

        if (emailExists) {
          return apiResponse.ErrorResponse(res, ADMIN.emailExists);
        }
      }

      // Check if phone is being updated and already exists (including deleted users)
      if (updateFields.phone && updateFields.phone !== currentUser.phone) {
        const phoneExists = await db("users")
          .where("phone", updateFields.phone)
          .whereNot("id", id)
          .first();

        if (phoneExists) {
          return apiResponse.ErrorResponse(res, USER.phoneNumberExists);
        }
      }

      let walletUpdated = false;
      let referralBonusUpdated = false;
      let newBalance = null;
      let newBonus = null;

      // Wallet update
      if (updateFields.wallet_balance !== undefined) {
        newBalance = Number(updateFields.wallet_balance);

        await db("users")
          .where({ id })
          .update({ wallet_balance: newBalance, updated_at: db.fn.now() });

        await db("wallet")
          .where({ user_id: id })
          .update({ balance: newBalance, updated_at: db.fn.now() });

        walletUpdated = true;

        delete updateFields.wallet_balance;
      }

      // Referral bonus update
      if (updateFields.referral_bonus !== undefined) {
        newBonus = Number(updateFields.referral_bonus);

        await db("users")
          .where({ id })
          .update({ referral_bonus: newBonus, updated_at: db.fn.now() });

        referralBonusUpdated = true;

        delete updateFields.referral_bonus;
      }

      // Other fields update
      const [updated] = await db("users")
        .where({ id })
        .update(updateFields)
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      // Send notifications
      if (walletUpdated) {
        const title = "Wallet Updated by Admin";
        const content = `Your wallet balance has been updated to ৳${newBalance}`;

        await db("notifications").insert({
          user_id: id,
          title,
          content,
          is_read: false,
          sent_at: db.fn.now(),
          created_at: db.fn.now(),
        });
      }

      if (referralBonusUpdated) {
        const title = "Referral Bonus Updated";
        const content = `Your referral bonus has been updated to ৳${newBonus}`;

        await db("notifications").insert({
          user_id: id,
          title,
          content,
          is_read: false,
          sent_at: db.fn.now(),
          created_at: db.fn.now(),
        });
      }

      return apiResponse.successResponseWithData(
        res,
        USER.userUpdated,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },


  async changeStatus(req, res) {
    try {
      const { id } = req.body;
      const { status } = req.body;

      if (![0, 1, 2].includes(status)) {
        return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
      }

      const [updated] = await db("users")
        .where({ id })
        .update({ status, updated_at: db.fn.now() })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        USER.statusUpdated,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.body;

      const [updated] = await db("users")
        .where({ id })
        .update({ status: 2, updated_at: db.fn.now() })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, USER.userNotDeleted);
      }

      return apiResponse.successResponseWithData(
        res,
        USER.userMarkedAsDeleted,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async addReferralCode(req, res) {
    try {
      const { userId, bonus = 0 } = req.body;

      if (!userId) {
        return apiResponse.ErrorResponse(res, USER.userIDrequired);
      }

      const user = await db("users").where({ id: userId }).first();
      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      let referralCode;
      let exists = true;
      while (exists) {
        referralCode = generateReferralCode();
        const codeExists = await db("users")
          .where("referral_code", referralCode)
          .first();
        exists = !!codeExists;
      }

      const [updated] = await db("users").where({ id: userId }).update(
        {
          referral_code: referralCode,
          referral_bonus: bonus,
          updated_at: db.fn.now(),
        },
        "*"
      );
      await db("notifications").insert({
        user_id: userId,
        title: "Referral Code Genrated",
        content: `Your referral code ${referralCode} has been generated successfully. got a bonus of ৳${bonus}.`,
        created_at: db.fn.now(),
        is_read: false,
      });

      return apiResponse.successResponseWithData(
        res,
        USER.referralCodeAdded,
        updated
      );
    } catch (error) {
      console.error("Error in addReferralCode:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = userController;
