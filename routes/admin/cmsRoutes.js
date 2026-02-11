const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const cmsController = require('../../controllers/admin/cmsController');
const upload = require('../../middleware/uploads');

router.post('/addContent', adminAuth, upload.single('image'), cmsController.addContent);
router.post('/getAllContent', adminAuth, cmsController.getAllContent);
router.get('/getOneContent/:id', adminAuth, cmsController.getOneContent);
router.put('/updateContent', adminAuth, upload.single('image'), cmsController.updateContent);
router.put('/changeStatus', adminAuth, cmsController.changeStatus);

module.exports = router; 