const { knex: db } = require('../../config/database');
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SCREENSHOT, SUCCESS } = require("../../utils/responseMsg");
const path = require("path");
const fs = require("fs");
const appRoot = require("app-root-path");

const TABLE = 'screenshot';

const ScreenshotController = {
  async addScreenshot(req, res) {
    try {
     
      if (!req.files || req.files.length === 0) {
        return apiResponse.ErrorResponse(res, "No files uploaded");
      }

      // Prepare all inserts
      const inserts = req.files.map((file) => {
        const cleanName = file.originalname.replace(/\s+/g, "_");
        const filePath = file.path.replace(/\\/g, "/").replace(/\s+/g, "_");

        // detect file type
        const fileType = file.mimetype.startsWith("video/") ? "video" : "image";

        return {
          name: cleanName,
          file_url: filePath,
          file_type: fileType,
          status: 1,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        };
      });

      const results = await db(TABLE)
        .insert(inserts)
        .returning(["id", "name", "file_url", "file_type"]);

      return apiResponse.successResponseWithData(res, "success", results);
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

      const screenshot = await db(TABLE).where({ id }).first();
      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Screenshot not found");
      }

      const updateData = { updated_at: db.fn.now() };
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

      const [updatedScreenshot] = await db(TABLE)
        .where({ id })
        .update(updateData)
        .returning(["id", "name", "file_url", "file_type"]);

      return apiResponse.successResponseWithData(
        res,
        "Screenshot updated successfully",
        updatedScreenshot
      );
    } catch (error) {
      console.error("UpdateScreenshot Error:", error);
      return apiResponse.ErrorResponse(res, "Oops, Something went wrong. Please try again later.");
    }
  },

  async getOneScreenshot(req, res) {
    try {
      const { id } = req.params;
      const screenshot = await db(TABLE)
        .select("id", "name", "file_url", "file_type", "status")
        .where({ id })
        .first();

      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Screenshot not found");
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, screenshot);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllScreenshots(req, res) {
    try {
      const result = await db(TABLE)
        .select("id", "name", "file_url", "file_type", "status")
        .orderBy("created_at", "desc");

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, result);
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

      const screenshot = await db(TABLE).where({ id }).first();
      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Screenshot not found");
      }

      const filePath = path.resolve(
        appRoot.path,
        "public",
        "screenshots",
        path.basename(screenshot.file_url)
      );

     

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        
      } else {
        console.warn("File not found on disk:", filePath);
      }

      await db(TABLE).where({ id }).del();

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

      const screenshot = await db(TABLE).where({ id }).first();
      if (!screenshot) {
        return apiResponse.notFoundResponse(res, "Media not found");
      }

      const newStatus = screenshot.status === 1 ? 0 : 1;

      const [result] = await db(TABLE)
        .where({ id })
        .update({ status: newStatus, updated_at: db.fn.now() })
        .returning(["id", "name", "file_url", "file_type", "status"]);

      return apiResponse.successResponseWithData(
        res,
        "Media status updated successfully.",
        result
      );
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
  
};

module.exports = ScreenshotController;
