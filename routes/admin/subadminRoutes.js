const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const cmsController = require('../../controllers/admin/subadminController');

router.post('/addSubadmin', adminAuth, cmsController.addSubadmin);
router.post('/getAllSubadmin', adminAuth, cmsController.getAllSubadmin);
router.get('/getOneSubadmin/:id', adminAuth, cmsController.getOneSubadmin);
router.post('/updateSubadmin', adminAuth, cmsController.updateSubadmin);
router.post('/changeStatus', adminAuth, cmsController.changeStatus);
router.post('/deleteSubadmin', adminAuth, cmsController.deleteSubadmin);

module.exports = router; 