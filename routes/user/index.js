const express = require("express");
const router = express.Router();

// Import user route modules
const authRoutes = require("./authRoutes");
const contestRoutes = require("./contestRoutes");
const matchRoutes = require("./matchRoutes");
const teamRoutes = require("./teamRoutes");
const fantasyTeamRoutes = require("./fantasyTeamRoutes");
const tournamentRoutes = require("./tournamentRoutes");
const walletRoutes = require("./walletRoutes");
const playerRoutes = require("./playerStatsRoutes");
const apayroutes = require("./apayRoutes")
const socialroutes = require("./socialRoutes")

// Mount user routes
router.use("/auth", authRoutes);
router.use("/contests", contestRoutes);
router.use("/matches", matchRoutes);
router.use("/teams", teamRoutes);
router.use("/fantasyTeams", fantasyTeamRoutes);
router.use("/tournaments", tournamentRoutes);
router.use("/wallet", walletRoutes);
router.use("/player", playerRoutes);
router.use("/apay",apayroutes)
router.use("/socials",socialroutes)

module.exports = router;
