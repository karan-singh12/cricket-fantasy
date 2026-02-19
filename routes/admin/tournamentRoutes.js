const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const tournamentsController = require('../../controllers/admin/tournamentController');
const upload = require('../../middleware/uploads');

// Tournament Management Routes
router.post('/test', tournamentsController.testTournaments);
router.post('/getAllTournaments', adminAuth, tournamentsController.getAllTournaments);
router.get('/:id', adminAuth, tournamentsController.getTournamentById);
router.post('/sync', tournamentsController.syncTournaments);
router.post('/createTournament', adminAuth, tournamentsController.createTournament);
router.put('/:id', adminAuth, tournamentsController.updateTournament);
router.post("/:id", adminAuth, tournamentsController.toggleTournamentStatus)
router.delete('/:id', adminAuth, tournamentsController.deleteTournament);

// Tournament Teams and Matches Routes
router.get('/:id/teams', adminAuth, tournamentsController.getTournamentTeams);
router.get('/:id/matches', adminAuth, tournamentsController.getTournamentMatches);
router.post('/:id/sync-teams', tournamentsController.syncTournamentTeams);
router.post('/:id/sync-matches', tournamentsController.syncTournamentMatches);

router.get('/matches/:matchId', tournamentsController.getMatchDetails);

router.get('/team/:id', adminAuth, tournamentsController.getOneTeam);
router.post('/updateTeam', adminAuth, upload.single('image'), tournamentsController.updateTeam);

module.exports = router;