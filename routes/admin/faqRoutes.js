const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const fxn = require('../../controllers/admin/faqControllers');

router.post('/addFaq', adminAuth, fxn.addFaq);
router.post('/getAllFaqs', adminAuth, fxn.getAllFaqs);
router.get('/getOneFaq/:id', adminAuth, fxn.getOneFaq);
router.post('/updateFaq', adminAuth, fxn.updateFaq);
router.post('/changeStatus', adminAuth, fxn.changeStatus);
router.post('/deleteFaq', adminAuth, fxn.deleteFaq);

module.exports = router; 