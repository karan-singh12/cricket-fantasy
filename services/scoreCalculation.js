const mongoose = require("mongoose");
const Match = require("../models/Match");
const FantasyTeam = require("../models/FantasyTeam");
const FantasyGame = require("../models/FantasyGame");
const FantasyPoint = require("../models/FantasyPoint");
const PlayerStat = require("../models/PlayerStat");

async function updateLeaderboardForTodayMatches() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const matches = await Match.find({
      start_time: { $gte: today, $lt: tomorrow },
    });

    for (const match of matches) {
      const matchId = match._id;
      const matchType = match.match_type?.toLowerCase() || 't20';

      const fantasyGames = await FantasyGame.find({ contest: { $exists: true } }) // Logic to find games for this match
        .populate({
          path: 'fantasy_team',
          match: { match: matchId }
        }).lean();

      // Filter out games where fantasy_team didn't match the matchId
      const matchGames = fantasyGames.filter(g => g.fantasy_team);

      console.log(`Found ${matchGames.length} fantasy teams for match ${matchId}`);

      const fantasyPointsRules = await FantasyPoint.find({ status: { $ne: 2 } }).lean();
      if (!fantasyPointsRules.length) {
        console.log("No fantasy points rules found, skipping point calculation");
        continue;
      }

      const allPlayerStats = await PlayerStat.find({ match: matchId }).lean();
      if (!allPlayerStats.length) {
        console.log(`No player match statistics found for match ${matchId}, skipping`);
        continue;
      }

      function getPoints(rule, mType) {
        const safe = (val) => (typeof val === "number" && !isNaN(val) ? val : 0);
        switch (mType) {
          case "t20": case "t20i": case "100-ball": return safe(rule.points_t20);
          case "odi": case "youth odi": case "list a": return safe(rule.points_odi);
          case "test": case "test/5day": case "4day": return safe(rule.points_test);
          case "t10": return safe(rule.points_t10);
          default: return safe(rule.points_t20);
        }
      }

      function calculatePointsByAction(action, mType) {
        const rule = fantasyPointsRules.find((fp) => fp.action === action);
        if (!rule) return 0;
        return getPoints(rule, mType);
      }

      for (const game of matchGames) {
        const team = game.fantasy_team;
        if (!team || !team.players) continue;

        let totalScore = 0;

        for (const pData of team.players) {
          const stat = allPlayerStats.find((s) => s.player.toString() === pData.player.toString());
          if (!stat || pData.substitute) continue;

          let playerPoints = 0;

          // Basic runs
          if (stat.runs_scored > 0) {
            playerPoints += calculatePointsByAction("run", matchType) * stat.runs_scored;
          }
          // Boundary bonuses
          if (stat.fours > 0) playerPoints += calculatePointsByAction("four", matchType) * stat.fours;
          if (stat.sixes > 0) playerPoints += calculatePointsByAction("six", matchType) * stat.sixes;

          // Wickets
          if (stat.wickets > 0) playerPoints += calculatePointsByAction("wicket", matchType) * stat.wickets;

          // Milestone examples (simplified)
          if (stat.runs_scored >= 50) playerPoints += calculatePointsByAction("half_century", matchType);
          if (stat.runs_scored >= 100) playerPoints += calculatePointsByAction("century", matchType);

          // Multipliers
          let multiplier = 1;
          if (pData.is_captain) multiplier = 2;
          else if (pData.is_vice_captain) multiplier = 1.5;

          totalScore += playerPoints * multiplier;
        }

        // Update FantasyTeam and FantasyGame
        await FantasyTeam.findByIdAndUpdate(team._id, { total_points: totalScore });
        await FantasyGame.findByIdAndUpdate(game._id, { points: totalScore });
      }

      await updateRanksForMatch(matchId);
    }

    return { success: true };
  } catch (error) {
    console.error("updateLeaderboardForTodayMatches error:", error);
    return { success: false, error: error.message };
  }
}

async function updateRanksForMatch(matchId) {
  // Collect all games for this match across all contests
  const games = await FantasyGame.find()
    .populate({
      path: 'fantasy_team',
      match: { match: matchId }
    });

  const validGames = games.filter(g => g.fantasy_team);

  // Sort by points descending
  validGames.sort((a, b) => (b.points || 0) - (a.points || 0));

  // Update ranks
  for (let i = 0; i < validGames.length; i++) {
    validGames[i].rank = i + 1;
    await validGames[i].save();
  }
}

module.exports = {
  updateLeaderboardForTodayMatches,
};
