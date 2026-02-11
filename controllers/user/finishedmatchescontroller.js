const mongoose = require("mongoose");
const moment = require("moment");
const FantasyGame = require("../../models/FantasyGame");
const FantasyTeam = require("../../models/FantasyTeam");
const Match = require("../../models/Match");
const MatchPlayer = require("../../models/MatchPlayer");
const Contest = require("../../models/Contest");
const Team = require("../../models/Team");
const Tournament = require("../../models/Tournament");
const User = require("../../models/User");
const config = require("../../config/config");
const apiResponse = require('../../utils/apiResponse');
const { ERROR, SUCCESS } = require("../../utils/responseMsg");

async function getMyFinishedMatches(req, res) {
  try {
    const userId = req.user.id;

    // Aggregate to find finished matches for user
    const entries = await FantasyGame.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "contests",
          localField: "contest",
          foreignField: "_id",
          as: "contest_info"
        }
      },
      { $unwind: "$contest_info" },
      {
        $lookup: {
          from: "matches",
          localField: "contest_info.match",
          foreignField: "_id",
          as: "match_info"
        }
      },
      { $unwind: "$match_info" },
      { $match: { "match_info.status": { $in: ["Finished", "Completed"] } } },
      {
        $group: {
          _id: "$match_info._id",
          match: { $first: "$match_info" },
          contests: {
            $push: {
              id: "$contest_info._id",
              points: "$points",
              rank: "$rank",
              fantasy_team: "$fantasy_team"
            }
          }
        }
      },
      { $sort: { "match.start_time": -1 } }
    ]);

    if (entries.length === 0) {
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, []);
    }

    const formattedMatches = await Promise.all(entries.map(async (entry) => {
      const match = entry.match;
      const t1 = await Team.findById(match.team1).lean();
      const t2 = await Team.findById(match.team2).lean();
      const tour = await Tournament.findById(match.tournament).lean();

      const contestIds = [...new Set(entry.contests.map(c => c.id.toString()))];
      const teamIds = [...new Set(entry.contests.map(c => c.fantasy_team.toString()))];

      const contestsData = await Promise.all(entry.contests.map(async (c) => {
        const ft = await FantasyTeam.findById(c.fantasy_team).select("name").lean();
        const contestDetail = await Contest.findById(c.id).select("filled_spots").lean();
        const user = await User.findById(userId).select("name image_url").lean();

        return {
          contest_id: c.id,
          team_label: ft?.name || "T1",
          fantasy_team_id: c.fantasy_team,
          fantasy_team_name: ft?.name || "T1",
          points: c.points,
          filled_spots: contestDetail?.filled_spots || 0,
          username: user?.name,
          profile_image: user?.image_url ? `${config.baseURL}/${user.image_url}` : null,
          rank: c.rank > 0 ? c.rank : null
        };
      }));

      return {
        start_time: match.start_time,
        id: match._id,
        tournament_id: match.tournament,
        sm_match_id: match.sportmonks_id,
        team1_name: t1?.name,
        team1_short_name: t1?.short_name,
        team1_logo_url: t1?.logo_url,
        team2_name: t2?.name,
        team2_short_name: t2?.short_name,
        team2_logo_url: t2?.logo_url,
        tournament_name: tour?.name,
        total_contest: contestIds.length,
        total_teams: teamIds.length,
        status: match.status,
        end_time: match.end_time,
        created_at: match.created_at,
        updated_at: match.updated_at,
        time_ago: moment(match.start_time).fromNow(),
        contests: contestsData
      };
    }));

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, formattedMatches);
  } catch (error) {
    console.error("getMyFinishedMatches error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

async function getFinishedMatchDetails(req, res) {
  try {
    const userId = req.user.id;
    const { sm_match_id } = req.body;

    const match = await Match.findOne({ sportmonks_id: sm_match_id })
      .populate("team1")
      .populate("team2")
      .populate("tournament")
      .lean();

    if (!match) {
      return apiResponse.notFoundResponse(res, "Match not found");
    }

    const metadata = match.metadata || {};
    let toss = null;
    let result_note = metadata.note || null;
    let winner_team = null;

    if (metadata.toss_won_team_id) {
      const tossTeamName = metadata.toss_won_team_id === match.team1?.sportmonks_id ? match.team1?.name : match.team2?.name;
      toss = `${tossTeamName} won the toss and elected to ${metadata.elected}`;
    }

    if (metadata.winner_team_id) {
      const winTeam = metadata.winner_team_id === match.team1?.sportmonks_id ? match.team1 : match.team2;
      if (winTeam) {
        winner_team = {
          id: winTeam._id,
          name: winTeam.name,
          short_name: winTeam.short_name,
          logo_url: winTeam.logo_url
        };
      }
    }

    const games = await FantasyGame.find({ user: userId })
      .populate({
        path: "contest",
        match: { match: match._id }
      })
      .populate("fantasy_team")
      .lean();

    const userGames = games.filter(g => g.contest);

    const teams = await Promise.all(userGames.map(async (game) => {
      const ft = game.fantasy_team;
      if (!ft) return null;

      const players = ft.players || [];
      let team1_count = 0;
      let team2_count = 0;

      const formattedPlayers = await Promise.all(players.map(async (p) => {
        const playerDoc = await MatchPlayer.findOne({ match: match._id, player: p.player })
          .populate("player")
          .lean();

        const pInfo = playerDoc?.player;
        if (pInfo) {
          if (pInfo.team?.toString() === match.team1._id.toString()) team1_count++;
          else team2_count++;
        }

        return {
          id: p.player,
          player_id: p.player,
          name: pInfo?.name,
          role: pInfo?.role,
          credits: pInfo?.credits,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          substitute: p.is_substitute,
          fantasy_point: p.points || 0,
          imagePath: pInfo?.image_url,
          in_lineup: playerDoc?.is_playing_xi || playerDoc?.is_substitute,
          is_playing_xi: playerDoc?.is_playing_xi,
          is_substitute: playerDoc?.is_substitute
        };
      }));

      return {
        fantasy_team_id: ft._id,
        fantasy_team_name: ft.name,
        team_label: game.team_name_user || ft.name,
        total_points: game.points,
        rank: game.rank > 0 ? game.rank : null,
        contest_id: game.contest._id,
        contest_name: game.contest.name,
        filled_spots: game.contest.filled_spots,
        team1_player_count: team1_count,
        team2_player_count: team2_count,
        players: formattedPlayers
      };
    }));

    const sortedTeams = teams.filter(t => t !== null).sort((a, b) => (a.rank || 999999) - (b.rank || 999999));

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
      sm_match_id: match.sportmonks_id,
      team1_name: match.team1?.name,
      team1_short_name: match.team1?.short_name,
      team1_logo_url: match.team1?.logo_url,
      team2_name: match.team2?.name,
      team2_short_name: match.team2?.short_name,
      team2_logo_url: match.team2?.logo_url,
      tournament_name: match.tournament?.name,
      status: match.status,
      start_time: match.start_time,
      end_time: match.end_time,
      created_at: match.created_at,
      updated_at: match.updated_at,
      time_ago: moment(match.start_time).fromNow(),
      toss,
      result_note,
      winner_team,
      scorecard: match.scorecard,
      metadata: match.metadata,
      contest: sortedTeams
    });
  } catch (error) {
    console.error("getFinishedMatchDetails error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

async function getMatchTeams(req, res) {
  try {
    const userId = req.user.id;
    const { sm_match_id } = req.body;

    const match = await Match.findOne({ sportmonks_id: sm_match_id })
      .populate("team1")
      .populate("team2")
      .lean();

    if (!match) return apiResponse.ErrorResponse(res, "Match not found");

    const userGames = await FantasyGame.find({ user: userId })
      .populate({
        path: "contest",
        match: { match: match._id }
      })
      .populate("fantasy_team")
      .lean();

    const relevantGames = userGames.filter(g => g.contest);

    const teams = await Promise.all(relevantGames.map(async (game) => {
      const ft = game.fantasy_team;
      if (!ft) return null;

      const formattedPlayers = await Promise.all(ft.players.map(async (p) => {
        const playerDoc = await MatchPlayer.findOne({ match: match._id, player: p.player }).populate("player").lean();
        const pInfo = playerDoc?.player;
        return {
          id: p.player,
          name: pInfo?.name,
          role: pInfo?.role,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          substitute: p.is_substitute,
          fantasy_point: p.points || 0,
          teamId: pInfo?.team
        };
      }));

      return {
        fantasy_team_id: ft._id,
        fantasy_team_name: ft.name,
        match_id: match._id,
        players: formattedPlayers,
        team1_id: match.team1?._id,
        team1_image: match.team1?.logo_url,
        team1_short_name: match.team1?.short_name,
        team2_id: match.team2?._id,
        team2_image: match.team2?.logo_url,
        team2_short_name: match.team2?.short_name,
        total_points: game.points,
      };
    }));

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, teams.filter(t => t !== null));
  } catch (error) {
    console.error('getMatchTeams error:', error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

async function getContestLeaderboardWithPagination(req, res) {
  try {
    const { contest_id, page = 1 } = req.body;
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    const contest = await Contest.findById(contest_id).populate("match").lean();
    if (!contest) return apiResponse.notFoundResponse(res, "Contest not found");

    const totalCount = await FantasyGame.countDocuments({ contest: contest_id });

    const leaderboards = await FantasyGame.find({ contest: contest_id })
      .populate("user", "name image_url")
      .populate("fantasy_team", "name players")
      .sort({ points: -1, created_at: 1 })
      .limit(pageSize)
      .skip(skip)
      .lean();

    const formattedList = leaderboards.map(entry => ({
      fantasy_team_id: entry.fantasy_team?._id,
      team_label: entry.team_name_user || entry.fantasy_team?.name,
      fantasy_team_name: entry.fantasy_team?.name,
      rank: entry.rank > 0 ? entry.rank : null,
      points: entry.points,
      username: entry.user?.name,
      profile_image: entry.user?.image_url ? `${config.baseURL}/${entry.user.image_url}` : null,
    }));

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
      contest_id,
      total: totalCount,
      list: formattedList.sort((a, b) => (a.rank || 999999) - (b.rank || 999999)),
      total_participants: contest.filled_spots || 0,
      pagination: {
        current_page: parseInt(page),
        page_size: pageSize,
        total_pages: Math.ceil(totalCount / pageSize),
        total_entries: totalCount
      }
    });
  } catch (error) {
    console.error("getContestLeaderboard error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

module.exports = {
  getMyFinishedMatches,
  getFinishedMatchDetails,
  getMatchTeams,
  getContestLeaderboardWithPagination
};