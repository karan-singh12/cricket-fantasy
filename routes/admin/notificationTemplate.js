const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const fxn = require('../../controllers/admin/notificationTemplateController');

// Routes for notification templates
router.post('/addNotificationTemplate', adminAuth, fxn.addNotificationTemplate);
router.post('/getAllTemplate', adminAuth, fxn.getAllTemplates);
router.get('/getOneTemplate/:id', adminAuth, fxn.getOneTemplate);
router.post('/updateTemplate', adminAuth, fxn.updateTemplate);
router.post('/changeStatus', adminAuth, fxn.changeStatus);
router.post('/deleteTemplate', adminAuth, fxn.deleteTemplate);

// Create sample notification data
router.post('/createSample', adminAuth, fxn.createSampleNotification);

module.exports = router;