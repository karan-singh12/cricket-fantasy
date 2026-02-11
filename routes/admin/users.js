const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const cmsController = require('../../controllers/admin/userController');
const upload = require('../../middleware/uploads');

router.post('/addUser', adminAuth, cmsController.addUser);
router.post('/getAllUser', adminAuth, cmsController.getAllUser);
router.get('/getOneUser/:id', adminAuth, cmsController.getOneUser);
router.post('/updateUser', adminAuth,upload.single('image'), cmsController.updateUser);
router.post('/changeStatus', adminAuth, cmsController.changeStatus);
router.post('/deleteUser', adminAuth, cmsController.deleteUser);
router.post("/addReferralCode",adminAuth,cmsController.addReferralCode)
module.exports = router; 