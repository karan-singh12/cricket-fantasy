const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/adminAuth");
const referralController = require("../../controllers/admin/referralController");

router.get(
  "/getallsettings",
  adminAuth,
  referralController.getReferralSettings
);
router.post(
  "/updatesettings",
  adminAuth,
  referralController.updateReferralSettings
);

router.post("/getstats", adminAuth, referralController.getReferralStats);
router.post(
  "/getanalytics",
  adminAuth,
  referralController.getReferralAnalytics
);

router.post("/getallreferrals", adminAuth, referralController.getAllReferrals);
router.get(
  "/referrer/:referrer_id",
  adminAuth,
  referralController.getReferrerDetails
);

router.post("/add-bonus", adminAuth, referralController.addReferralBonus);
router.post("/exportdata", adminAuth, referralController.exportReferralData);

module.exports = router;
