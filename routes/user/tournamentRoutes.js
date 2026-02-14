const express = require('express');
const router = express.Router();
const userAuth = require('../../middleware/userAuth');
const tournamentsController = require('../../controllers/user/tournamentController');

// Tournament Viewing Routes
router.post('/', userAuth, tournamentsController.getAllTournaments);
router.get('/:id', userAuth, tournamentsController.getTournamentById);
router.get('/:id/matches', userAuth, tournamentsController.getTournamentMatches);

module.exports = router; 