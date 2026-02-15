const { knex: db } = require("../../config/database");
const config = require("../../config/config");
const apiResponse = require("../../utils/apiResponse");
const bcrypt = require("bcrypt");
const { slugGenrator } = require("../../utils/functions");
const { ADMIN, ERROR, SUCCESS } = require("../../utils/responseMsg");
const { sendEmail } = require("../../utils/email");

const generateRandomPassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#&";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const SubadminController = {
  async addSubadmin(req, res) {
    try {
      const name = req.body.name;
      const email = req.body.email.toLowerCase();
      const permissionsArray = req.body.permission || [];

      // Check if subadmin already exists (case-insensitive)
      const existingAdmin = await db("admins")
        .whereRaw("LOWER(email) = ?", [email])
        .whereIn("status", [0, 1])
        .first();

      if (existingAdmin) {
        return apiResponse.ErrorResponse(res, ADMIN.emailExists);
      }

      // Generate random password
      const randomPassword = generateRandomPassword();
   

      // Hash the password
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Insert subadmin into DB
      const [newSubadmin] = await db("admins")
        .insert({
          name,
          email,
          password: hashedPassword,
          role: "subAdmin",
          permission: db.raw("ARRAY[?]::text[]", [permissionsArray]),
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      // Fetch email template
      const templateResult = await db("emailtemplates")
        .select("content", "subject")
        .where({
          slug: process.env.USER_SEND_PASSWORD,
          status: 1,
        })
        .first();

      if (templateResult) {
        let content = templateResult.content;
        content = content.replace("{name}", name);
        content = content.replace("{email}", email);
        content = content.replace("{password}", randomPassword);

        const options = {
          to: email,
          subject: templateResult.subject,
          html: content,
        };

        sendEmail(options);
       
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.subadminAdded,
        newSubadmin
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllSubadmin(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "desc",
        status = [],
      } = req.body;

      pageNumber = Math.max(0, pageNumber - 1);
      let query = db("admins")
        .whereNot("status", 2)
        .andWhereNot("role", "admin");

      if (status.length > 0) {
        query.andWhere((qb) => qb.whereIn("status", status));
      }

      if (searchItem) {
        query.andWhere((builder) =>
          builder
            .whereILike("name", `%${searchItem}%`)
            .orWhereILike("email", `%${searchItem}%`)
        );
      }

      const totalRecords = await query.clone().count().first();

      const result = await query
        .select("id", "name", "email", "status", "created_at")
        .orderBy(sortBy, sortOrder)
        .limit(pageSize)
        .offset(pageSize * pageNumber);

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords: parseInt(totalRecords.count),
        pageNumber: pageNumber + 1,
        pageSize,
      });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneSubadmin(req, res) {
    try {
      const { id } = req.params;

      const Subadmin = await db("admins").where({ id }).select("*").first();

      if (!Subadmin) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        Subadmin
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateSubadmin(req, res) {
    try {
      const { id, email, name, status } = req.body;

      const updateFields = {
        name,
        status,
        updated_at: db.fn.now(),
      };

      if (email) {
        const loweredEmail = email.toLowerCase();
        const existingAdmin = await db("admins")
          .whereRaw("LOWER(email) = ?", [loweredEmail])
          .whereNot("id", id)
          .whereIn("status", [0, 1])
          .first();

        if (existingAdmin) {
          return apiResponse.ErrorResponse(
            res,
            "Email is already in use by another admin"
          );
        }
        updateFields.email = loweredEmail;
      }

      const [updated] = await db("admins")
        .where({ id })
        .update(updateFields)
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.subadminUpdated,
        updated
      );
    } catch (error) {
      console.error("Update subadmin error:", error.message);
      if (error.code === "23505") {
        return apiResponse.ErrorResponse(
          res,
          "Email is already in use by another admin"
        );
      }
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.body;
      const { status } = req.body;

      if (![0, 1, 2].includes(status)) {
        return apiResponse.ErrorResponse(res, ADMIN.invalidStatus);
      }

      const [updated] = await db("admins")
        .where({ id })
        .update({ status, updated_at: db.fn.now() })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.statusUpdated,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteSubadmin(req, res) {
    try {
      const { id } = req.body;

      const [updated] = await db("admins")
        .where({ id })
        .update({ status: 2, updated_at: db.fn.now() })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.subadminDeleted,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = SubadminController;
