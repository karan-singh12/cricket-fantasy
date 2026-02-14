const express = require("express");
const router = express.Router();
const fxn = require("../../controllers/admin/sportmonksController");
const auth = require("../../middleware/adminAuth");

//* Public routes 
router.get("/syncAllLeagues", auth, fxn.getLeagues); // fetch Tournaments and save in .........

router.post("/teams", auth, fxn.getSeasonsTeams); // fetch all  teams in a tournament.......

router.post("/fixtures", auth, fxn.getSeasonsFixtures); // fetch matches....

// router.post('/teams/squad', auth, fxn.getTeamSquad);
router.post("/teamplayers", auth, fxn.getTeamSquad); // fetch players  of a teamid .......

router.get("/season/stages", auth, fxn.getSeasonStages); // fetch and insert/update seasonstages

router.get("/getAllCountries", auth, fxn.getCountries); // fetch countries and insert update

router.get("/getAllVenues", auth, fxn.getVenues); // fetch venues and insert update

router.get("/getScores", auth, fxn.getScores);

router.get("/scoreCalculation", auth, fxn.scoreCalculation);

router.get("/getFixtureDetails", auth, fxn.getNewFixtureDetails);

router.get("/players", auth, fxn.updateAllPlayers); // update players and carrer stats points

router.get("/teams/:teamId", auth, fxn.getTeamDetails);
router.post("/syncMatchPlayers/:matchId", auth, fxn.syncMatchPlayers);
router.post("/syncMatchLineup/:matchId", auth, fxn.syncMatchLineup);
router.post("/syncUpcomingLineups", auth, fxn.syncUpcomingLineups);
router.post("/syncJustStartedLineups", auth, fxn.syncJustStartedLineups);

// Manually refresh scoreboards for a specific match (by DB id or SM id)
router.post("/refreshMatchScoreboards/:matchId", auth, fxn.refreshMatchScoreboards);

// Refresh today's live and upcoming match scoreboards
router.post("/updateLiveScoreboards", auth, fxn.updateLiveScoreboards);


router.get("/players/:playerId", auth, fxn.getPlayerDetails);

router.get("/syncAllTournamentData", auth, fxn.syncAllTournamentData);
router.get("/syncAllTournamentData2", auth, fxn.syncAllTournamentData2);
router.get("/syncAllTournamentTeams", auth, fxn.syncAllTournamentTeams);
router.post("/syncTeamsSquadsBySeason", auth, fxn.syncTeamsSquadsBySeason);
router.get("/db-teams", auth, fxn.getAllTeams);

router.post("/completeContest/:contestId", auth, fxn.completeContestManually);


module.exports = router;
