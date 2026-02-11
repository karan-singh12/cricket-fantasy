const express = require('express');
const router = express.Router();
const userAuth = require('../../middleware/userAuth');
const contestController = require('../../controllers/user/contestController');

// Contest Routes
router.post('/getAllContest', userAuth, contestController.getAvailableContests);
router.post('/createContest', userAuth, contestController.createContest);
router.post('/my-contests', userAuth, contestController.getMyContests);
router.post('/join', userAuth, contestController.joinContest);
// router.get('/:contest_id/leaderboard', userAuth, contestController.getContestLeaderboard);
router.get('/:contest_id', userAuth, contestController.getContestDetails);
router.get('/match/:matchId/recent', userAuth, contestController.getRecentContests);
router.post('/updateContestName', userAuth, contestController.editContestName);

module.exports = router; 