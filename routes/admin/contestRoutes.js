const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const contestController = require('../../controllers/admin/contestController');

// Contest Management Routes
router.post('/getAllContests', adminAuth, contestController.getAllContests);
router.get('/getOneContest/:id', adminAuth, contestController.getContestDetails);
router.post('/createContest', adminAuth, contestController.createContest);
router.post('/updateContest', adminAuth, contestController.updateContest);
router.post('/deleteContest', adminAuth, contestController.deleteContest);
router.post('/changeStatus', adminAuth, contestController.updateContestStatus);

// Contest Prize Management
router.put('/contests/:id/prize-breakup', adminAuth, contestController.updatePrizeBreakup);

module.exports = router; 