const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/adminAuth");

const upload = require("../../middleware/uploads");
const ScreenshotController = require("../../controllers/admin/screenshotsController");

router.post(
  "/addScreenshot",
  upload.array("file", 4),
  ScreenshotController.addScreenshot
);
router.get("/getAllScreenshots", ScreenshotController.getAllScreenshots);
router.post("/deleteScreenshot", ScreenshotController.deleteScreenshot);
router.post("/chnagestatus", ScreenshotController.changeStatus);

module.exports = router;
