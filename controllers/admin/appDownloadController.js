const { log } = require("winston");
const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS } = require("../../utils/responseMsg");
const path = require("path");
const fs = require("fs");
const { platform } = require("os");
const config = require("../../config/config");

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

      const [file] = await db("app_downloads")
        .insert({
          file_name: req.file.originalname,
          file_path: `apk/${req.file.filename}`,
          current_version, // save version
          previous_version,
          platform,
        })
        .returning(["id", "file_name", "file_path"]);

      return apiResponse.successResponseWithData(res, "APK uploaded", {
        id: file.id,
        file_name: file.file_name,
        file_path: file.file_path,
        current_version, // save version
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

      const deleted = await db("app_downloads").where({ id }).first();

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

      await db("app_downloads").where({ id }).del();

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

      const file = await db("app_downloads").where({ id }).first();
      if (!file) {
        return res.status(404).send("File not found in DB");
      }

      // full absolute path
      const filePath = path.join(__dirname, "../../public", file.file_path);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("File missing on server");
      }

      // send file
      return res.download(filePath, file.file_name);
    } catch (error) {
      console.error(error);
      return res.status(500).send("Something went wrong");
    }
  },

  async userDownloadLatest(req, res) {
    try {
      const file = await db("app_downloads")
        .orderBy("created_at", "desc")
        .first();

      if (!file) {
        return apiResponse.ErrorResponse(
          res,
          ERROR.notFound || "No APK available"
        );
      }

      const downloadUrl = `${process.env.BACKEND_URL || config.backendUrl || "https://mybest11bd.com"}/public/${file.file_path}`;

      return res.status(200).json({ path: downloadUrl });

    } catch (error) {
      console.error("User Download APK error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAll(req, res) {
    try {
      const apps = await db("app_downloads")
        .select(
          "id",
          "file_name",
          "file_path",
          "current_version",
          "previous_version",
          "platform"
        )
        .orderBy("created_at", "desc");

      if (!apps.length) {
        return apiResponse.successResponseWithData(res, "No APKs found", []);
      }

      return apiResponse.successResponseWithData(
        res,
        "All uploaded APKs",
        apps
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

      const latest = await db("app_downloads")
        .where({ platform })
        .orderBy("created_at", "desc")
        .first();

      if (!latest) {
        return apiResponse.ErrorResponse(res, "No app found for this platform");
      }


      const forceUpdate =
        compareVersions(currentVersion, latest.current_version) < 0;

      // Optional update: only if you want to show suggestion for versions between previous_version and current_version
      const optionalUpdate =
        !forceUpdate &&
        compareVersions(currentVersion, latest.previous_version) < 0;

      // Prepare download URL
      let download_url = "";
      if (platform === "android") {
        download_url = `${process.env.BACKEND_URL || config.backendUrl || "https://mybest11bd.com"
          }/public/${latest.file_path}`;
      } else if (platform === "ios") {
        download_url = latest.ios_app_store_link || "";
      }
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
        download_url: download_url,
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
