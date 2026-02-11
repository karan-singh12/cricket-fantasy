const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/adminAuth");
const fxn = require("../../controllers/admin/teamManagerController");

router.post("/getAllFantasyTeams", adminAuth, fxn.getAllFantasyTeams);
router.post("/getAllFantasyTeamsBot", adminAuth, fxn.getAllBotFantasyTeams);


router.get("/getFantasyTeamById/:id", adminAuth, fxn.getFantasyTeamById);

module.exports = router;
