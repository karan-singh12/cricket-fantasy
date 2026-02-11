const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const cmsController = require('../../controllers/admin/emailTemplateController');

router.post('/addEmailTemplate', adminAuth, cmsController.addEmailTemplate);
router.post('/getAllTemplate', adminAuth, cmsController.getAllTemplate);
router.get('/getOneTemplate/:id', adminAuth, cmsController.getOneTemplate);
router.put('/updateTemplate', adminAuth, cmsController.updateTemplate);
router.put('/changeStatus', adminAuth, cmsController.changeStatus);

module.exports = router; 