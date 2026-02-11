const mongoose = require("mongoose");
const Contest = require("../../models/Contest");
const Match = require("../../models/Match");
const FantasyTeam = require("../../models/FantasyTeam");
const FantasyGame = require("../../models/FantasyGame");
const User = require("../../models/User");
const Team = require("../../models/Team");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, CONTEST } = require("../../utils/responseMsg");

const contestController = {
  async getContestLeaderboard(req, res) {
    try {
      const { contest_id } = req.params;
      const { page = 1, limit = 10, user_id } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const contest = await Contest.findById(contest_id);
      if (!contest) return apiResponse.ErrorResponse(res, CONTEST.contestNotFound);

      // Entries (FantasyGame)
      const entriesQuery = { contest: contest_id, status: { $ne: 'deleted' } };

      const totalEntries = await FantasyGame.countDocuments(entriesQuery);

      const entries = await FantasyGame.find(entriesQuery)
        .populate("user", "name username image_url")
        .populate("fantasy_team", "name total_points")
        .sort({ points: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const leaderboard = entries.map(entry => ({
        id: entry._id,
        user_id: entry.user?._id,
        username: entry.user?.username || entry.user?.name,
        profile_image: entry.user?.image_url,
        team_name: entry.fantasy_team?.name,
        total_points: entry.points || entry.fantasy_team?.total_points || 0,
        rank: entry.rank
      }));

      let userRankInfo = null;
      if (user_id) {
        const userEntry = await FantasyGame.findOne({ contest: contest_id, user: user_id });
        if (userEntry) {
          if (userEntry.rank) {
            userRankInfo = userEntry.rank;
          } else {
            const rank = await FantasyGame.countDocuments({
              contest: contest_id,
              points: { $gt: userEntry.points || 0 }
            }) + 1;
            userRankInfo = rank;
          }
        }
      }

      let winnings = contest.winnings;
      if (typeof winnings === 'string') {
        try { winnings = JSON.parse(winnings); } catch (e) { }
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        leaderboard,
        total_entries: totalEntries,
        user_rank: userRankInfo,
        contest: {
          id: contest._id,
          name: contest.name,
          total_spots: contest.max_teams, // mapped max_teams to total_spots logic
          filled_spots: contest.joined_teams,
          entry_fee: contest.entry_fee,
          prize_pool: contest.prize_pool,
          winnings,
          status: contest.status,
        },
      });

    } catch (error) {
      console.error("Leaderboard error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAvailableContests(req, res) {
    try {
      let { matchId, entryFeeRange, totalSpotsRange, contestType } = req.body;

      if (!matchId) return apiResponse.ErrorResponse(res, CONTEST.matchIdrequired);

      const query = {
        match: matchId,
        status: { $nin: ["deleted", "completed", "cancelled"] } // Exclude finished
      };
      console.log("getAvailableContests Query:", query);

      const contests = await Contest.find(query).populate({
        path: "match",
        populate: { path: "team1 team2", select: "name" }
      });
      console.log(`Found ${contests.length} contests`);

      if (entryFeeRange?.start != null && entryFeeRange?.end != null) {
        query.entry_fee = { $gte: entryFeeRange.start, $lte: entryFeeRange.end };
      }
      if (totalSpotsRange?.start != null && totalSpotsRange?.end != null) {
        query.max_teams = { $gte: totalSpotsRange.start, $lte: totalSpotsRange.end }; // max_teams = total_spots
      }
      if (contestType) {
        query.contest_type = contestType;
      }

      const updatedContests = contests.map((contest, idx) => {
        console.log(`Processing contest ${idx + 1}/${contests.length}`);
        let winnings = contest.winnings;
        let winningsTotal = 0;
        let winningPercentage = 0;

        if (winnings) {
          try {
            if (typeof winnings === "string") winnings = JSON.parse(winnings);
            if (Array.isArray(winnings)) {
              winningsTotal = winnings.reduce((sum, win) => sum + (win.price || 0), 0);
              const maxWinners = Math.max(...winnings.map((win) => win.to));
              if (contest.max_teams > 0) {
                winningPercentage = Math.round((maxWinners / contest.max_teams) * 100);
              }
            } else if (typeof winnings === 'object') {
              // Handle object format { "1": 500, "2": 300 }
              winningsTotal = Object.values(winnings).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
              const ranks = Object.keys(winnings).map(k => parseInt(k)).filter(n => !isNaN(n));
              if (ranks.length > 0 && contest.max_teams > 0) {
                const maxRank = Math.max(...ranks);
                winningPercentage = Math.round((maxRank / contest.max_teams) * 100);
              }
            }
          } catch (e) {
            console.error("Winnings processing error:", e);
          }
        }

        const remainingSpots = Math.max(0, contest.max_teams - contest.joined_teams);
        const matchDoc = contest.match;

        return {
          ...contest.toObject(),
          team1_name: matchDoc?.team1?.name,
          team2_name: matchDoc?.team2?.name,
          start_time: matchDoc?.start_time,
          winnings_total: winningsTotal,
          winning_percentage: winningPercentage,
          remaining_spots: remainingSpots,
          total_spots: contest.max_teams
        };
      });
      console.log("Finished processing contests.");

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, { contests: updatedContests });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async createContest(req, res) {
    try {
      const {
        match_id, name, entry_fee, total_prize_pool, prize_breakup, winnings,
        start_time, end_time, total_spots, contest_type, per_user_entry,
      } = req.body;

      if (!match_id) return apiResponse.ErrorResponse(res, CONTEST.matchIdrequired);

      const match = await Match.findOne({ _id: match_id, status: "NS" });
      if (!match) return apiResponse.ErrorResponse(res, CONTEST.invalidmatchNOTNS);

      const contest = new Contest({
        match: match_id,
        name,
        entry_fee,
        prize_pool: total_prize_pool,
        max_teams: total_spots,
        joined_teams: 0,
        // tournament_id? Not in schema but useful. Derived from Match.
        // start_time/end_time? Usually derived from Match.
        contest_type,
        max_teams_per_user: per_user_entry,
        winnings: typeof winnings === 'string' ? JSON.parse(winnings) : winnings,
        // rules? Schema flexible?
        // created_by_user?
        is_mega_contest: false // default
      });

      await contest.save();
      return apiResponse.successResponseWithData(res, CONTEST.contestAdded, contest);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMyContests(req, res) {
    try {
      const userId = req.user.id;
      const { match_id } = req.body;

      const query = { user: userId };
      if (match_id) {
        // Need to find Contests for this match first, then filtering FantasyGames?
        // FantasyGame has `contest` ref. 
        // Helper: Find contest IDs for match.
        const contestIds = await Contest.find({ match: match_id }).distinct('_id');
        query.contest = { $in: contestIds };
      }

      const games = await FantasyGame.find(query)
        .populate({
          path: "contest",
          populate: {
            path: "match",
            populate: { path: "team1 team2", select: "name logo_url short_name" }
          }
        })
        .populate({
          path: "fantasy_team",
          populate: {
            path: "players.player",
            select: "name image_url role" // Populating player details
          }
        })
        .sort({ created_at: -1 });

      const contestsWithWinnings = await Promise.all(games.map(async (game, index) => {
        const contest = game.contest;
        if (!contest) return null; // Should not happen

        const fantasyTeam = game.fantasy_team;
        const match = contest.match;

        // Winnings Calc
        let winningsTotal = 0;
        let winningPercentage = 0;
        let winnings = contest.winnings;
        try {
          if (typeof winnings === "string") winnings = JSON.parse(winnings);
          if (Array.isArray(winnings)) {
            winningsTotal = winnings.reduce((sum, win) => sum + (win.price || 0), 0);
            const maxWinners = Math.max(...winnings.map(w => w.to));
            if (contest.max_teams > 0) winningPercentage = Math.round((maxWinners / contest.max_teams) * 100);
          }
        } catch (e) { }

        const remainingSpots = Math.max(0, contest.max_teams - contest.joined_teams);

        // Players & Backup Logic
        let players = [];
        let backup_players = [];
        let captain = null;
        let viceCaptain = null;

        if (fantasyTeam && fantasyTeam.players) {
          fantasyTeam.players.forEach(pData => {
            const p = pData.player; // populated
            if (!p) return;
            const playerObj = {
              id: p._id,
              name: p.name,
              role: p.role || p.position,
              is_captain: pData.is_captain,
              is_vice_captain: pData.is_vice_captain,
              image_path: p.image_url,
              substitute: pData.is_substitute,
              // team info? If Player has team ref or via PlayerTeam?
              // Simplified: We assume we show player info directly. 
            };

            if (pData.is_captain) captain = playerObj;
            if (pData.is_vice_captain) viceCaptain = playerObj;

            if (pData.is_substitute) backup_players.push(playerObj);
            else players.push(playerObj);
          });
        }

        return {
          ...contest.toObject(),
          match_start_time: match?.start_time,
          team1_name: match?.team1?.name,
          team2_name: match?.team2?.name,
          fantasy_team_name: fantasyTeam?.name,
          fantasy_team_id: fantasyTeam?._id,
          user_rank: game.rank,
          user_points: game.points,
          entry_status: game.status,
          captain_name: captain?.name,
          captain_image: captain?.image_path,
          vice_captain_name: viceCaptain?.name,
          vice_captain_image: viceCaptain?.image_path,
          winnings_total: winningsTotal,
          winning_percentage: winningPercentage,
          remaining_spots: remainingSpots,
          players,
          backup_players
        };
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, contestsWithWinnings.filter(Boolean));
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async joinContest(req, res) {
    try {
      const userId = req.user.id;
      const { contest_id, fantasy_team_id } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const contest = await Contest.findOne({ _id: contest_id, status: { $ne: 'deleted' } }).session(session);
        if (!contest) throw new Error("Contest not found");

        if (contest.joined_teams >= contest.max_teams) throw new Error("Contest is full");

        const team = await FantasyTeam.findOne({ _id: fantasy_team_id, user: userId }).session(session);
        if (!team) throw new Error("Fantasy team not found");

        const existing = await FantasyGame.findOne({ contest: contest_id, fantasy_team: fantasy_team_id }).session(session);
        if (existing) throw new Error("Already joined");

        await FantasyGame.create([{
          user: userId,
          contest: contest_id,
          fantasy_team: fantasy_team_id,
          status: "joined",
          created_at: new Date()
        }], { session });

        contest.joined_teams += 1;
        await contest.save({ session });

        await session.commitTransaction();
        return apiResponse.successResponse(res, "Successfully joined contest");
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } catch (error) {
      return apiResponse.ErrorResponse(res, error.message || ERROR.somethingWrong);
    }
  },

  async getContestDetails(req, res) {
    try {
      const { contest_id } = req.params;
      const contest = await Contest.findById(contest_id)
        .populate({
          path: "match",
          populate: { path: "team1 team2", select: "name" }
        });

      if (!contest) return apiResponse.ErrorResponse(res, CONTEST.contestNotFound);

      // Winnings Logic
      let winnings = contest.winnings;
      let firstPrize = 0;
      let winPercentage = 0;
      try {
        if (typeof winnings === "string") winnings = JSON.parse(winnings);
        if (Array.isArray(winnings)) {
          const first = winnings.find(w => w.from === 1 && w.to === 1);
          firstPrize = first ? first.price : 0;
          const totalWinners = winnings.reduce((acc, w) => acc + (w.to - w.from + 1), 0);
          if (contest.max_teams > 0) winPercentage = Math.round((totalWinners / contest.max_teams) * 100);
        }
      } catch (e) { }

      const userTeamsCount = await FantasyGame.countDocuments({
        contest: contest_id,
        user: req.user.id
      });

      const finalContest = {
        ...contest.toObject(),
        firstPrize,
        winPercentage,
        totalUserTeams: userTeamsCount,
        team1_name: contest.match?.team1?.name,
        team2_name: contest.match?.team2?.name,
        start_time: contest.match?.start_time
      };

      return apiResponse.successResponseWithData(res, CONTEST.contestFound, { contest: finalContest });
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async editContestName(req, res) {
    try {
      const { contestId, name } = req.body;
      const contest = await Contest.findOneAndUpdate(
        { _id: contestId, created_by_user: req.user.id },
        { name },
        { new: true }
      );
      if (!contest) return apiResponse.ErrorResponse(res, CONTEST.contestNotCreatedbyYou);

      return apiResponse.successResponseWithData(res, CONTEST.contestUpdated, contest);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getRecentContests(req, res) {
    try {
      const { matchId } = req.params;
      const { page = 1, limit = 10, user_id } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = { match: matchId, status: "completed" };

      const contests = await Contest.find(query)
        .sort({ end_time: -1 }) // ensure end_time in schema or use updated_at
        .skip(skip)
        .limit(parseInt(limit));

      // Populate particpant counts?
      // Aggregation needed for participant count and user joined check.
      // This is getting complex again.
      // Simpler: 
      const result = await Promise.all(contests.map(async c => {
        const count = await FantasyGame.countDocuments({ contest: c._id });
        const userJoined = user_id ? await FantasyGame.exists({ contest: c._id, user: user_id }) : false;

        // highest score?
        const topScore = await FantasyGame.findOne({ contest: c._id }).sort({ points: -1 }).select("points");

        return {
          ...c.toObject(),
          participants_count: count,
          user_joined: !!userJoined,
          highest_score: topScore?.points || 0
        };
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, result);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = contestController;
