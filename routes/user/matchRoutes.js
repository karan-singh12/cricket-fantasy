const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const matchController = require('../../controllers/user/matchController');

// Match viewing routes
router.get('/:tournament_id/getAllmatchesOfTournament',auth, matchController.getAllmatchesOfTournaments);
router.get('/:tournament_id/getAllmatchesOfTournament/:category',auth, matchController.getAllmatchesOfTournament);
router.get('/matches/live', auth, matchController.getLiveMatches);
router.get('/matches/completed', auth, matchController.getCompletedMatches);
router.get('/matches/:id', auth, matchController.getMatchDetails);
router.get('/matches/:id/scorecard', auth, matchController.getMatchScorecard);
router.get('/matches/:matchId/players', matchController.getMatchPlayers);

module.exports = router; 