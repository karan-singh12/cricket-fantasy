const express = require("express");
const router = express.Router();
const userAuth = require("../../middleware/userAuth");

const kycUpload = require("../../middleware/kycUploads");
const walletController = require("../../controllers/user/walletController");

// Wallet Routes
router.get("/getWalletDetails", userAuth, walletController.getWalletDetails);
router.post(
  "/getAllTransactions",
  userAuth,
  walletController.getAllTransactions
);
router.post(
  "/kycVefication",
  userAuth,
  kycUpload.fields([
    { name: "panFront", maxCount: 1 },
    { name: "panBack", maxCount: 1 },
  ]),
  walletController.kycVefication
);

router.post("/withdrawFunds", userAuth, walletController.withdrawFunds);
// Bkash
router.post("/addFunds", userAuth, walletController.payment_create); // Bkash payment initiation
router.post("/bkashPaymentSuccess", userAuth, walletController.payment_execute); // Bkash payment execution
router.get("/payment/callback", walletController.bkash_callback); // Bkash payment callback
router.post(
  "/withdrawFundsBkash",
  userAuth,
  walletController.withdrawFundsBkash
); // Bkash payment withdraw

module.exports = router;
