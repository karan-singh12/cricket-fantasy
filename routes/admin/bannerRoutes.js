const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const cmsController = require('../../controllers/admin/bannerController');
const upload = require('../../middleware/uploads');

router.post('/addBanner', adminAuth, upload.single('image'), cmsController.addBanner);
router.post('/getAllBanners', adminAuth, cmsController.getAllBanners);
router.get('/getOneBanner/:id', adminAuth, cmsController.getOneBanner);
router.post('/updateBanner', adminAuth, upload.single('image'), cmsController.updateBanner);
router.post('/changeStatus', adminAuth, cmsController.changeStatus);
router.post('/deleteBanner', adminAuth, cmsController.deleteBanner);

module.exports = router; 