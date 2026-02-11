const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const playerController = require('../../controllers/admin/playerController');

// Player Management Routes
router.get('/players', adminAuth, playerController.getAllPlayers);
router.post('/players', adminAuth, playerController.createPlayer);
router.put('/players/:id', adminAuth, playerController.updatePlayer);
router.delete('/players/:id', adminAuth, playerController.deletePlayer);
router.put('/players/:id/status', adminAuth, playerController.updatePlayerStatus);

router.get('/updatePlayersWithRandomData', adminAuth, playerController.updatePlayersWithRandomData);

// Player Stats Management
router.post('/players/:id/stats', adminAuth, playerController.updatePlayerStats);
router.get('/players/team/:teamId', adminAuth, playerController.getPlayersByTeam);
router.get('/players/match/:matchId', adminAuth, playerController.getPlayersByMatch);

module.exports = router; 