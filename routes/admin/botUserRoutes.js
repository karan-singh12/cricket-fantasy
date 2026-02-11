const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const cmsController = require('../../controllers/admin/botUserController');
const upload = require('../../middleware/uploads');

router.post('/addBotUser', adminAuth, cmsController.addBotUser);
router.post('/getAllBotUser', adminAuth, cmsController.getAllBotUser);
router.get('/getOneBotUser/:id', adminAuth, cmsController.getOneBotUser);
router.post('/updateBotUser', adminAuth,upload.single('image'), cmsController.updateBotUser);
router.post('/changeStatus', adminAuth, cmsController.changeStatus);
router.post('/deleteBotUser', adminAuth, cmsController.deleteBotUser);
module.exports = router; 