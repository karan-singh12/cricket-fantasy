const Screenshot = require('../../models/Screenshot');
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS } = require("../../utils/responseMsg");
const path = require("path");
const fs = require("fs");
const appRoot = require("app-root-path");

const ScreenshotController = {
  async addScreenshot(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return apiResponse.ErrorResponse(res, "No files uploaded");
      }

      const inserts = req.files.map((file) => {
        const cleanName = file.originalname.replace(/\s+/g, "_");
        const filePath = file.path.replace(/\\/g, "/").replace(/\s+/g, "_");
        const fileType = file.mimetype.startsWith("video/") ? "video" : "image";

        return {
          name: cleanName,
          file_url: filePath,
          file_type: fileType,
          status: 1,
        };
      });

      const results = await Screenshot.insertMany(inserts);

      const mapping = results.map(r => ({
        id: r._id,
        name: r.name,
        file_url: r.file_url,
        file_type: r.file_type
      }));

      return apiResponse.successResponseWithData(res, "success", mapping);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateScreenshot(req, res) {
    try {
      const { id, name } = req.body;
      if (!id) {
        return apiResponse.ErrorResponse(res, "Screenshot ID is required");
      }

      const screenshot = await Screenshot.findById(id);
      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Screenshot not found");
      }

      const updateData = {};
      if (name) updateData.name = name;

      if (req.file) {
        const newFilePath = req.file.path.replace(/\\/g, "/");
        const newFileType = req.file.mimetype.startsWith("video/") ? "video" : "image";

        const oldFilePath = path.join(appRoot.path, screenshot.file_url);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }

        updateData.file_url = newFilePath;
        updateData.file_type = newFileType;
      }

      const updated = await Screenshot.findByIdAndUpdate(id, updateData, { new: true }).lean();

      return apiResponse.successResponseWithData(
        res,
        "Screenshot updated successfully",
        { ...updated, id: updated._id }
      );
    } catch (error) {
      console.error("UpdateScreenshot Error:", error);
      return apiResponse.ErrorResponse(res, "Oops, Something went wrong. Please try again later.");
    }
  },

  async getOneScreenshot(req, res) {
    try {
      const { id } = req.params;
      const screenshot = await Screenshot.findById(id)
        .select("name file_url file_type status")
        .lean();

      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Screenshot not found");
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, { ...screenshot, id: screenshot._id });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllScreenshots(req, res) {
    try {
      const result = await Screenshot.find()
        .select("name file_url file_type status")
        .sort({ created_at: -1 })
        .lean();

      const mapped = result.map(r => ({ ...r, id: r._id }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, mapped);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteScreenshot(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return apiResponse.notFoundResponse(res, "Id required");
      }

      const screenshot = await Screenshot.findById(id);
      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Screenshot not found");
      }

      const filePath = path.join(appRoot.path, screenshot.file_url);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await Screenshot.findByIdAndDelete(id);

      return apiResponse.successResponse(res, "Media deleted successfully.");
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return apiResponse.notFoundResponse(res, "Id required");
      }

      const screenshot = await Screenshot.findById(id);
      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Media not found");
      }

      const newStatus = screenshot.status === 1 ? 0 : 1;
      screenshot.status = newStatus;
      await screenshot.save();

      return apiResponse.successResponseWithData(
        res,
        "Media status updated successfully.",
        { ...screenshot.toObject(), id: screenshot._id }
      );
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = ScreenshotController;
