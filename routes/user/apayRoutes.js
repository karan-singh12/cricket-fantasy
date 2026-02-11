const express = require("express");
const router = express.Router();
const apayController = require("../../controllers/user/apayController");
const auth = require("../../middleware/auth");
// router.post("/deposit", auth.auth, apayController.createDeposit);
router.post("/create-payment-page", auth.auth, apayController.createPaymentPage);
router.get(
  "/deposit-status/:order_id",
  auth.auth,
  apayController.getDepositStatus
);
router.post("/withdrawal", auth.auth, apayController.createWithdrawal);
router.get("/payment-systems", auth.auth, apayController.getPaymentSystems);
router.post("/webhook/deposit", apayController.handleDepositWebhook);
router.post("/webhook/withdrawal", apayController.handleWithdrawalWebhook);
router.get("/payment-callback", apayController.handlePaymentCallback);
router.post("/deposit-activate", auth.auth, apayController.activateDeposit);
router.get(
  "/transaction/:order_id/:type",
  auth.auth,
  apayController.getTransactionStatus
);

module.exports = router;
