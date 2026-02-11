const express = require("express");
const router = express.Router();
const userAuth = require("../../middleware/userAuth");
const userAuthController = require("../../controllers/user/authController");
const upload = require("../../middleware/uploads");

// User Authentication Routes
router.post("/login", userAuthController.login);
router.post("/socialLogin", userAuthController.socialLogin);

router.get("/personalDetails", userAuth, userAuthController.getProfile);

router.post(
  "/updatePersonalDetails",
  userAuth,
  upload.single("image"),
  userAuthController.updateProfile
);

router.post("/updateEmail", userAuth, userAuthController.updateEmail);

router.post("/verifyOtp", userAuthController.verifyOtp);

router.post("/updateftoken", userAuth, userAuthController.updateFtoken);

router.post("/verifyEmail", userAuth, userAuthController.verifyEmail);

router.post("/resendOtp", userAuthController.resendOtp);

router.post("/resendAuthOtp", userAuth, userAuthController.resendAuthOtp);

router.post("/change-password", userAuth, userAuthController.changePassword);

router.post("/forgot-password", userAuthController.forgotPassword);

router.post("/reset-password", userAuthController.resetPassword);

router.get("/getFaqs", userAuthController.getFaqs);

router.get("/getAboutUs", userAuthController.getAboutUs);

router.get("/getTerms", userAuthController.getAboutUs);

router.get("/getPrivacy", userAuthController.getAboutUs);

router.get("/getBanners", userAuthController.getBanners);

router.get("/getHowToPlay", userAuthController.getHowtoPlay);

router.get("/getLicenceInformation", userAuthController.getAboutUs);

router.post("/contactUs", userAuth, userAuthController.contactUs);
router.post("/contactUss", userAuthController.contactUs);

router.post("/customerSupport", userAuthController.contactUs);

router.get("/getReferralCode", userAuth, userAuthController.getReferralCode);

router.get("/deleteAccount", userAuth, userAuthController.deleteAccount);

router.get("/scorecardList", userAuthController.scorecardList);

router.post("/getNotifications", userAuth, userAuthController.getNotifications);
router.post("/readNotification", userAuth, userAuthController.readNotification);
router.put("/markAllAsRead", userAuth, userAuthController.markAllAsRead);
router.post(
  "/setNotification",
  userAuth,
  userAuthController.updatesetisNotification
);
router.post("/followUnfollow", userAuth, userAuthController.followUnfollow);
router.get(
  "/getUsersProfile/:id",
  userAuth,
  userAuthController.getUserProfileById
);
router.post("/blockUnblock", userAuth, userAuthController.blockUnblock);
router.post("/reportUser", userAuth, userAuthController.reportProfile);

module.exports = router;
