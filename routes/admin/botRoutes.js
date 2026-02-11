const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const botController = require('../../controllers/admin/botController');

router.post('/addBotUser', adminAuth, botController.createBotUser);
router.post('/getAllBotUser', adminAuth, botController.getAllBotUser);
router.get("/:id", adminAuth,botController.getBotUserById);
router.get('/matches/:matchId/players', botController.getMatchPlayers);
router.post('/addBottomatch', adminAuth, botController.ensureBotWinsContest);
router.post('/selectPlayers', adminAuth, botController.addPlayersToFantasyTeam);
router.post('/createFantasyTeam', adminAuth, botController.createFantasyTeam);
router.post('/editFantasyTeam', adminAuth, botController.editFantasyTeam);
router.post('/joinContest', adminAuth, botController.joinContest);
router.post("/updatebotuser",adminAuth,botController.updateBotUser)

module.exports = router; 