const AppDownload = require("../../models/AppDownload");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS } = require("../../utils/responseMsg");
const path = require("path");
const fs = require("fs");

const appDownload = {
  async upload(req, res) {
    try {
      if (!req.file) {
        return apiResponse.ErrorResponse(
          res,
          ERROR.fileRequired || "APK file is required"
        );
      }
      const { current_version, previous_version } = req.body;

      if (!current_version || !previous_version) {
        return apiResponse.ErrorResponse(
          res,
          "current Version and last Version are required"
        );
      }
      let platform = "unknown";
      const fileName = req.file.originalname.toLowerCase();

      if (
        fileName.endsWith(".apk") ||
        req.file.mimetype === "application/vnd.android.package-archive"
      ) {
        platform = "android";
      } else if (
        fileName.endsWith(".ipa") ||
        req.file.mimetype === "application/octet-stream"
      ) {
        platform = "ios";
      }

      const file = await AppDownload.create({
        file_name: req.file.originalname,
        file_path: `apk/${req.file.filename}`,
        current_version,
        previous_version,
        platform,
      });

      return apiResponse.successResponseWithData(res, "APK uploaded", {
        id: file._id,
        file_name: file.file_name,
        file_path: file.file_path,
        current_version,
        previous_version,
        platform,
      });
    } catch (error) {
      console.error("Upload APK error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      const deleted = await AppDownload.findById(id);

      if (!deleted) {
        return apiResponse.ErrorResponse(
          res,
          ERROR.notFound || "File not found"
        );
      }
      const filePath = path.join(__dirname, "../../public", deleted.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await AppDownload.findByIdAndDelete(id);

      return apiResponse.successResponse(
        res,
        SUCCESS.fileDeleted || "File deleted successfully"
      );
    } catch (error) {
      console.error("Delete APK error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async adminDownload(req, res) {
    try {
      const { id } = req.params;

      const file = await AppDownload.findById(id);
      if (!file) {
        return res.status(404).send("File not found in DB");
      }

      const filePath = path.join(__dirname, "../../public", file.file_path);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("File missing on server");
      }

      return res.download(filePath, file.file_name);
    } catch (error) {
      console.error(error);
      return res.status(500).send("Something went wrong");
    }
  },

  async userDownloadLatest(req, res) {
    try {
      const file = await AppDownload.findOne()
        .sort({ created_at: -1 })
        .lean();

      if (!file) {
        return apiResponse.ErrorResponse(
          res,
          ERROR.notFound || "No APK available"
        );
      }

      const filePath = path.join("public", file.file_path);

      return res.status(200).json({ path: filePath });

    } catch (error) {
      console.error("User Download APK error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAll(req, res) {
    try {
      const apps = await AppDownload.find()
        .sort({ created_at: -1 })
        .lean();

      if (!apps.length) {
        return apiResponse.successResponseWithData(res, "No APKs found", []);
      }

      const mappedApps = apps.map(app => ({
        ...app,
        id: app._id
      }));

      return apiResponse.successResponseWithData(
        res,
        "All uploaded APKs",
        mappedApps
      );
    } catch (error) {
      console.error("Get all APKs error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async forceUpdateCheck(req, res) {
    try {
      const { currentVersion, platform } = req.body;
      console.log("forceUpdateCheck body", req.body);

      if (!currentVersion || !platform) {
        return apiResponse.ErrorResponse(
          res,
          "Current version and platform are required"
        );
      }

      const latest = await AppDownload.findOne({ platform })
        .sort({ created_at: -1 })
        .lean();

      if (!latest) {
        return apiResponse.ErrorResponse(res, "No app found for this platform");
      }

      const forceUpdate =
        compareVersions(currentVersion, latest.current_version) < 0;

      const optionalUpdate =
        !forceUpdate &&
        compareVersions(currentVersion, latest.previous_version) < 0;

      let message = "Version check";
      if (forceUpdate) {
        message = "Latest version is out! Update now for the best experience";
      } else if (optionalUpdate) {
        message = "Latest version is out! Update now for the best experience";
      } else if (
        compareVersions(currentVersion, latest.current_version) === 0
      ) {
        message = "You’re already on the latest version!";
      }

      return apiResponse.successResponseWithData(res, message, {
        forceUpdate,
        optionalUpdate,
        latestVersion: latest.current_version,
        previousVersion: latest.previous_version,
        download_url: "https://mybest11bd.com",
      });
    } catch (error) {
      console.error("Force update check error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

function compareVersions(v1, v2) {
  const a = v1.split(".").map(Number);
  const b = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

module.exports = appDownload;
