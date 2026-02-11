const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/adminAuth");
const appDownload = require("../../controllers/admin/appDownloadController");
const multer = require("multer");
const uploads = require("../../middleware/uploads");

router.post("/upload", adminAuth, uploads.single("apk"), appDownload.upload);
router.post("/delete/:id", adminAuth, appDownload.delete);
router.get("/getall", adminAuth, appDownload.getAll);
// router.get("/download", appDownload.download);
router.get("/admin/download/:id", appDownload.adminDownload);
router.get("/user/download/latest", appDownload.userDownloadLatest);
router.post("/force-update", appDownload.forceUpdateCheck);


module.exports = router;
