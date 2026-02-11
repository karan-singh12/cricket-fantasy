const express = require("express");
const router = express.Router();
const userAuth = require("../../middleware/userAuth");
const teamController = require("../../controllers/user/fantasyTeamsController");
const finishedMatchesController = require("../../controllers/user/finishedmatchescontroller");

// Match viewing routes
router.get(
  "/getContestLeaderboard/:contest_id",
  userAuth,
  teamController.getContestLeaderboard
);
router.post("/selectPlayers", userAuth, teamController.addPlayersToFantasyTeam);
router.post("/createFantasyTeam", userAuth, teamController.createFantasyTeam);
router.get("/getFantasyTeam/:id", userAuth, teamController.getFantasyTeam);
router.post("/getMyAllTeams", userAuth, teamController.getMyAllTeams);
router.post("/joinContest", userAuth, teamController.joinContest);
router.get("/myMatches/:type", userAuth, teamController.myMatches);
router.post("/updateMyFantasyTeam", userAuth, teamController.updateFantasyTeam);
router.post("/addBackupPlayers", userAuth, teamController.addBackupPlayers);
router.post(
  "/updateMatchNotification",
  userAuth,
  teamController.toggleMatchNotificationById
);
router.post("/copyFantasyTeam", userAuth, teamController.copyFantasyTeam);

// new
router.get(
  "/myFinishedMatches",
  userAuth,
  finishedMatchesController.getMyFinishedMatches
);

router.post(
  "/matchDetails",
  userAuth,
  finishedMatchesController.getFinishedMatchDetails
);

router.post("/matchTeams", userAuth, finishedMatchesController.getMatchTeams);

router.post(
  "/contestLeaderboard",
  userAuth,
  finishedMatchesController.getContestLeaderboardWithPagination
);

module.exports = router;
