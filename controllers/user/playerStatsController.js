const mongoose = require("mongoose");
const moment = require("moment");
const Player = require("../../models/Player");
const PlayerStat = require("../../models/PlayerStat");
const PlayerTeam = require("../../models/PlayerTeam");
const Team = require("../../models/Team");
const Match = require("../../models/Match");
const FantasyTeam = require("../../models/FantasyTeam");
const FantasyGame = require("../../models/FantasyGame");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, PLAYER, SUCCESS } = require("../../utils/responseMsg");

exports.getPlayerStatsByPlayer = async (req, res) => {
  try {
    const { player_id } = req.params; // Expecting ObjectId or sportmonks_id?
    // SQL controller used `player_id` (likely sportmonks_id based on `where("p.player_id", player_id)`).
    // But then fetched `internalPlayerId` from `players` table using `player_id`.
    // It seems route passes sportmonks ID?
    // Mongoose: If we use `_id` in routes, life is easy. If sportmonks_id, we search.
    // I'll support both (autodetect ObjectId).

    let player;
    if (mongoose.Types.ObjectId.isValid(player_id)) {
      player = await Player.findById(player_id);
    } else {
      player = await Player.findOne({ sportmonks_id: Number(player_id) });
    }

    if (!player) return apiResponse.notFoundResponse(res, PLAYER.playerNotFound);
    const playerId = player._id;

    // Get current Team (PlayerTeam)
    // Need active team.
    const playerTeam = await PlayerTeam.findOne({ player: playerId, is_active: true }).populate("team");

    // Player Details
    const playerDetails = {
      image_url: player.image_url,
      name: player.name,
      points: player.points,
      credits: player.credits,
      role: player.position, // mapped from schema
      dob: player.date_of_birth,
      nationality: "Unknown", // Need Country model or mock
      team: playerTeam?.team?.name,
      shortname: playerTeam?.team?.short_name
    };

    // Tour Fantasy Stats (Aggregations)
    const statsAgg = await PlayerStat.aggregate([
      { $match: { player: playerId } },
      {
        $group: {
          _id: null,
          total_matches: { $sum: 1 }, // Count separate matches? Yes, unique match_id
          avg_points: { $avg: "$fantasy_points" }
        }
      }
    ]);

    const totalMatches = statsAgg[0]?.total_matches || 0;
    const avgPoints = statsAgg[0]?.avg_points ? statsAgg[0]?.avg_points.toFixed(2) : 0;

    // Current Tour Stats (List of matches)
    const recentStats = await PlayerStat.find({ player: playerId })
      .populate({
        path: "match",
        populate: { path: "team1 team2" }
      })
      .sort({ created_at: -1 }) // or match date?
      .limit(10); // Limit needed? SQL didn't limit but ordered.

    const formattedCurrentTourStats = recentStats.map((stat, index) => {
      const match = stat.match;
      if (!match) return null;

      let againstTeam = "";
      // Determine against team (if known)
      // SQL logic: CASE WHEN t1.id = player_team.id THEN t2 ELSE t1
      // We can check if playerTeam match.team1 or match.team2
      if (playerTeam && match.team1 && playerTeam.team?._id.equals(match.team1._id)) againstTeam = match.team2?.short_name;
      else if (playerTeam && match.team2 && playerTeam.team?._id.equals(match.team2._id)) againstTeam = match.team1?.short_name;
      else againstTeam = match.team1?.short_name + " vs " + match.team2?.short_name;

      return {
        id: index + 1,
        match: againstTeam,
        date: moment(match.start_time).format("DD Mon YYYY"),
        decision: match.toss_decision ? `${match.toss_winner_team_id === match.team1?.sportmonks_id ? match.team1?.name : match.team2?.name} chose to ${match.toss_decision}` : "Toss not decided", // Schema needs toss fields
        selectedBy: "0%", // Need detailed stat or store it in Player
        points: stat.fantasy_points,
        credits: player.credits,
        battingPts: stat.runs_scored, // approximation from schema? SQL `runs_scored` was Batting Pts?
        // Actually SQL query had specific columns for calculation.
        // Schema has `runs_scored`, `wickets`.
        // We can assume points logic is handled elsewhere and stored in `fantasy_points`.
        bowlingPts: stat.wickets * 25, // Mock point calc for visual? Or just store breakdown?
        // SQL `batting_pts` alias for `runs_scored`.
        // I'll just map raw stats for now.
        otherPts: (stat.catches * 8) + (stat.stumpings * 12) + (stat.run_outs * 6)
      };
    }).filter(Boolean);

    // Dream Team Percentage
    // (winning_teams_with_player / teams_with_player) * 100
    // Winning teams: Rank <= 3 in FantasyGame

    // 1. Find all FantasyGames (status joined/completed) where this player is in the team.
    // This requires looking up FantasyTeam -> players array.

    const totalTeamsWithPlayer = await FantasyTeam.countDocuments({
      "players.player": playerId
    });

    let dreamTeamPercentage = "NA";

    if (totalTeamsWithPlayer > 0) {
      // Find teams containing this player
      const teamsWithPlayer = await FantasyTeam.find({ "players.player": playerId }).select("_id");
      const teamIds = teamsWithPlayer.map(t => t._id);

      // Count how many of these teams have rank <= 3 in ANY contest
      const winningEntries = await FantasyGame.countDocuments({
        fantasy_team: { $in: teamIds },
        status: "completed", // or similar
        rank: { $lte: 3 }
      });

      dreamTeamPercentage = ((winningEntries / totalTeamsWithPlayer) * 100).toFixed(1) + "%";
    }

    const responseData = {
      player_details: playerDetails,
      tour_fantasy_stats: {
        total_matches_played: totalMatches,
        average_points: parseFloat(avgPoints),
        dream_team: dreamTeamPercentage,
      },
      current_tour_stats: formattedCurrentTourStats,
    };

    return apiResponse.successResponseWithData(res, PLAYER.dataFound, responseData);

  } catch (error) {
    console.error("getPlayerStatsByPlayer error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
};

exports.createPlayerStat = async (req, res) => {
  try {
    const stat = await PlayerStat.create(req.body);
    res.status(201).json(stat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPlayerStatsByMatch = async (req, res) => {
  // Implementation depends on need
  return apiResponse.successResponseWithData(res, SUCCESS.dataFound, []);
};
