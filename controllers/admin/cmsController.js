const path = require("path");
const Cms = require("../../models/Cms");
const apiResponse = require("../../utils/apiResponse");
const {
  slugGenrator,
  deleteFileIfExists,
} = require("../../utils/functions");
const { ERROR, CONTENT, SUCCESS, EMAILTEMPLATE, USER } = require("../../utils/responseMsg");

const contentController = {
  async addContent(req, res) {
    try {
      const { title, description, contentType, status = 1 } = req.body;

      const existingContent = await Cms.findOne({ contentType });

      if (existingContent) {
        return apiResponse.ErrorResponse(
          res,
          CONTENT.contentWithThisTypeAlreadyExists
        );
      }

      let imagePath = null;
      if (req.file) {
        imagePath = req.file.path.replace(/\\/g, "/");
      }

      const slug = await slugGenrator(contentType);

      const result = await Cms.create({
        title,
        description,
        contentType,
        slug,
        status,
        image_path: imagePath,
      });

      return apiResponse.successResponseWithData(
        res,
        CONTENT.contentAdded,
        result
      );
    } catch (error) {
      console.error(error);
      if (req.file && req.file.path) {
        deleteFileIfExists(req.file.path);
      }
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllContent(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        status = [],
      } = req.body;

      const limit = parseInt(pageSize) || 10;
      const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

      const filter = { status: { $ne: 2 } };

      if (status.length > 0) {
        filter.status = { $in: status.map(Number) };
      }

      if (searchItem) {
        filter.$or = [
          { title: { $regex: searchItem, $options: "i" } },
          { description: { $regex: searchItem, $options: "i" } }
        ];
      }

      const totalRecords = await Cms.countDocuments(filter);
      const result = await Cms.find(filter)
        .select("title contentType slug created_at status description")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Mapping created_at to createdAt for frontend parity if needed
      const mappedResult = result.map(item => ({
        ...item,
        id: item._id,
        createdAt: item.created_at
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: mappedResult,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneContent(req, res) {
    try {
      const result = await Cms.findById(req.params.id)
        .select("title description slug")
        .lean();

      if (!result) {
        return apiResponse.ErrorResponse(res, CONTENT.contentNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        { ...result, id: result._id }
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateContent(req, res) {
    try {
      const { id, title, description, status } = req.body;

      let imagePath = null;
      if (req.file) {
        imagePath = req.file.path.replace(/\\/g, "/");
      }

      const oldRecord = await Cms.findById(id);
      if (!oldRecord) {
        return apiResponse.ErrorResponse(res, CONTENT.contentNotFound);
      }

      const updateData = {
        title,
        description,
        status,
      };

      if (imagePath) {
        updateData.image_path = imagePath;
      }

      const data = await Cms.findByIdAndUpdate(id, updateData, { new: true }).lean();

      if (imagePath && oldRecord.image_path) {
        deleteFileIfExists(path.join(process.cwd(), oldRecord.image_path));
      }

      let msg = CONTENT.updateContent;

      switch (data.slug) {
        case process.env.PRIVACY_POLICY:
          msg = CONTENT.privacyUpdated;
          break;
        case process.env.TERMS:
          msg = CONTENT.termsUpdated;
          break;
        case process.env.ABOUT_US:
          msg = CONTENT.aboutUpdated;
          break;
        case process.env.APP_WELCOME_SCREEN:
          msg = CONTENT.welcomeUpdated;
          break;
        case process.env.COMMUNITY_GUIDELINES:
          msg = CONTENT.communityGuidelinesUpdated;
          break;
      }

      return apiResponse.successResponseWithData(res, msg, { ...data, id: data._id });
    } catch (error) {
      console.log(error.message);
      if (req.file && req.file.path) {
        deleteFileIfExists(req.file.path);
      }
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (![0, 1].includes(status)) {
        return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
      }

      const updated = await Cms.findByIdAndUpdate(id, { status }, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(
          res,
          EMAILTEMPLATE.templateNotFoundOrNotUpdated
        );
      }

      return apiResponse.successResponseWithData(
        res,
        `Status updated to ${status}`,
        { ...updated, id: updated._id }
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = contentController;
