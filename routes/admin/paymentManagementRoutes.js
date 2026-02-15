const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const apayController = require('../../controllers/user/apayController');


router.post("/allpaymentrequests", adminAuth, apayController.getAllpaymentRequests);
router.post("/payment/process", adminAuth, apayController.processPaymentRequest)
router.get("/paymentmatrics",adminAuth,apayController.getTransactionMetrics)


module.exports = router; 