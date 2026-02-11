const Admin = require("../../models/Admin");
const EmailTemplate = require("../../models/EmailTemplate");
const apiResponse = require("../../utils/apiResponse");
const bcrypt = require("bcryptjs");
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

      // Check if subadmin already exists
      const existingAdmin = await Admin.findOne({
        email: email,
        status: { $in: [0, 1] }
      });

      if (existingAdmin) {
        return apiResponse.ErrorResponse(res, ADMIN.emailExists);
      }

      const randomPassword = generateRandomPassword();

      // Mongoose middleware will hash the password
      const newSubadmin = await Admin.create({
        name,
        email,
        password: randomPassword,
        role: "subAdmin",
        permission: permissionsArray,
      });

      // Fetch email template
      const templateResult = await EmailTemplate.findOne({
        slug: process.env.USER_SEND_PASSWORD,
        status: 1,
      });

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

      const responseData = newSubadmin.toObject();
      delete responseData.password;

      return apiResponse.successResponseWithData(
        res,
        ADMIN.subadminAdded,
        { ...responseData, id: newSubadmin._id }
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

      const limit = parseInt(pageSize) || 10;
      const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

      const filter = {
        status: { $ne: 2 },
        role: { $ne: "admin" }
      };

      if (status.length > 0) {
        filter.status = { $in: status.map(Number) };
      }

      if (searchItem) {
        filter.$or = [
          { name: { $regex: searchItem, $options: "i" } },
          { email: { $regex: searchItem, $options: "i" } }
        ];
      }

      const totalRecords = await Admin.countDocuments(filter);
      const result = await Admin.find(filter)
        .select("name email status created_at")
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const mappedResult = result.map(admin => ({
        ...admin,
        id: admin._id
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: mappedResult,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
      });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneSubadmin(req, res) {
    try {
      const { id } = req.params;

      const subadmin = await Admin.findById(id).select("-password").lean();

      if (!subadmin) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        { ...subadmin, id: subadmin._id }
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
      };

      if (email) {
        const loweredEmail = email.toLowerCase();
        const existingAdmin = await Admin.findOne({
          email: loweredEmail,
          _id: { $ne: id },
          status: { $in: [0, 1] }
        });

        if (existingAdmin) {
          return apiResponse.ErrorResponse(
            res,
            "Email is already in use by another admin"
          );
        }
        updateFields.email = loweredEmail;
      }

      const updated = await Admin.findByIdAndUpdate(id, updateFields, { new: true }).select("-password").lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.subadminUpdated,
        { ...updated, id: updated._id }
      );
    } catch (error) {
      console.error("Update subadmin error:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (![0, 1, 2].includes(status)) {
        return apiResponse.ErrorResponse(res, ADMIN.invalidStatus);
      }

      const updated = await Admin.findByIdAndUpdate(id, { status }, { new: true }).select("-password").lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.statusUpdated,
        { ...updated, id: updated._id }
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteSubadmin(req, res) {
    try {
      const { id } = req.body;

      const updated = await Admin.findByIdAndUpdate(id, { status: 2 }, { new: true }).select("-password").lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, ADMIN.subadminNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        ADMIN.subadminDeleted,
        { ...updated, id: updated._id }
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = SubadminController;
