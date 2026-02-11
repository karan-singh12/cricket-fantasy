const express = require("express");
const router = express.Router();
const { auth } = require("../../middleware/auth");
const playerStatsController = require("../../controllers/user/playerStatsController");

router.get(
  "/getPlayerStatsByPlayerId/:player_id",
  auth,
  playerStatsController.getPlayerStatsByPlayer
);

module.exports = router;
