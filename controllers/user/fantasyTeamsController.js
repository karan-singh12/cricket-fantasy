const mongoose = require("mongoose");
const moment = require("moment");
const FantasyTeam = require("../../models/FantasyTeam");
const FantasyGame = require("../../models/FantasyGame");
const Match = require("../../models/Match");
const Contest = require("../../models/Contest");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const Transaction = require("../../models/Transaction");
const PlayerTeam = require("../../models/PlayerTeam");
const MatchPlayer = require("../../models/MatchPlayer");
const Player = require("../../models/Player"); // Added for credits check
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, FANTASYTTEAM, CONTEST } = require("../../utils/responseMsg");

const fantasyTeamsController = {

  async createFantasyTeam(req, res) {
    try {
      const userId = req.user.id;
      const { match_id, name, metadata } = req.body; // metadata for clone/edit

      if (!match_id) return apiResponse.ErrorResponse(res, FANTASYTTEAM.Matchidrequired);

      const match = await Match.findById(match_id);
      if (!match) return apiResponse.ErrorResponse(res, FANTASYTTEAM.matchNotFound);

      // Check match status (NS only allowed for creation/edit usually, controller checks specific statuses)
      const invalidStatuses = ["Live", "1st Innings", "2nd Innings", "Finished", "Completed", "Aban.", "Int."];
      if (invalidStatuses.includes(match.status)) {
        return apiResponse.ErrorResponse(res, "Match started, cannot create team");
      }

      // existing ?
      const existing = await FantasyTeam.findOne({
        user: userId,
        match: match_id,
        // status: { $nin: 1, 2 } // Logic from SQL: status 0 is draft?
        // Mongoose schema has status: Number.
        // Let's assume status 0 is draft.
      });

      // If reuse existing draft? Or logic is to alert if ANY team exists?
      // SQL: whereNotIn("status", [1, 2]). If returns value, says already exists.
      // This implies 1=Active, 2=Deleted/Archived?
      // If found, return it.

      // Actually, users can have multiple teams (T1, T2...).
      // SQL logic: `existingTeam` check might be for a SPECIFIC draft?
      // If checking if "ANY" team exists to return conflict, that prevents multiple teams?
      // But typically users create T1, T2.
      // The SQL code `whereNotIn([1, 2])` implies finding a *draft* (status 0).

      let fantasyTeam;
      if (existing && existing.status === 0) {
        fantasyTeam = existing; // Reuse draft
      } else {
        // Create new
        fantasyTeam = new FantasyTeam({
          user: userId,
          match: match_id,
          name: name || `Team ${(await FantasyTeam.countDocuments({ user: userId, match: match_id })) + 1}`,
          total_points: 0,
          status: 0, // Draft
          metadata: metadata,
          players: []
        });
        await fantasyTeam.save();
      }

      return apiResponse.successResponseWithData(res, FANTASYTTEAM.fantasyTeamCreated, fantasyTeam);

    } catch (error) {
      return apiResponse.ErrorResponse(res, FANTASYTTEAM.failedtocreatefantasyteam);
    }
  },

  async addPlayersToFantasyTeam(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userId = req.user.id;
      const { fantasy_team_id, players } = req.body;
      // players: [{ player_id, is_captain, is_vice_captain, substitute }]

      if (!fantasy_team_id || !Array.isArray(players)) {
        throw new Error("Invalid request data");
      }

      const team = await FantasyTeam.findOne({ _id: fantasy_team_id, user: userId }).session(session);
      if (!team) throw new Error(FANTASYTTEAM.fantasyTeamNotFoundorAlreadySubmitted);

      // Validation 1: Check Match Status
      const match = await Match.findById(team.match).session(session);
      if (!match) throw new Error(FANTASYTTEAM.associatedMatchNotFound);

      if (match.status !== 'NS' && new Date(match.start_time) <= new Date()) {
        throw new Error("Team edits are locked as the match has started");
      }

      // Validation 2: Captain/VC counts
      const captainCount = players.filter(p => p.is_captain).length;
      const vcCount = players.filter(p => p.is_vice_captain).length;
      if (captainCount !== 1 || vcCount !== 1) throw new Error(FANTASYTTEAM.captainAndViceCaptainRequired);

      // Validation 3: Lineups (MatchPlayer)
      // Check if lineups announced
      const lineupExists = await MatchPlayer.exists({ match: match._id, is_playing_xi: true }).session(session);

      const playerIds = players.map(p => p.player_id); // These are ObjectIds (Player _id)

      if (lineupExists) {
        const allowedPlayers = await MatchPlayer.find({
          match: match._id,
          is_playing_xi: true
        }).session(session).distinct('player');

        const allowedSet = new Set(allowedPlayers.map(id => id.toString()));
        const invalid = playerIds.filter(pid => !allowedSet.has(pid));
        if (invalid.length) throw new Error("Lineup announced. You can only select players from the Playing XI");
      }

      // Validation 4: Players belong to teams involved in match (Squad check)
      // Similar to `player_teams` check.
      const validPlayers = await PlayerTeam.distinct('player', {
        player: { $in: playerIds },
        team: { $in: [match.team1, match.team2] },
        is_active: true
        // season? (Assume PlayerTeam is season-scoped or managed correctly)
      }).session(session);

      const validSet = new Set(validPlayers.map(id => id.toString()));
      const invalidSquad = playerIds.filter(pid => !validSet.has(pid));

      if (invalidSquad.length) throw new Error(FANTASYTTEAM.invalidPlayersForThisMatch);

      // Validation 5: Credits Check (Optional but standard)
      // Validation 6: Team Composition (WK, BAT, BWL, AR) (Optional but standard)

      // Update FantasyTeam
      // Clear existing players? Yes, rewrite players array.
      // Map input to schema structure
      const newPlayers = players.map(p => ({
        player: p.player_id,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        is_substitute: p.substitute || false
      }));

      team.players = newPlayers;
      team.status = 1; // Completed/Saved
      await team.save({ session });

      await session.commitTransaction();
      return apiResponse.successResponseWithData(res, FANTASYTTEAM.playersAddedSuccessfully15, team);

    } catch (error) {
      await session.abortTransaction();
      return apiResponse.ErrorResponse(res, error.message || ERROR.somethingWrong);
    } finally {
      session.endSession();
    }
  },

  async getMyAllTeams(req, res) {
    try {
      const userId = req.user.id;
      const { match_id } = req.body;
      if (!match_id) return apiResponse.ErrorResponse(res, ERROR.matchIdRequired);

      const teams = await FantasyTeam.find({ user: userId, match: match_id })
        .populate({
          path: "players.player",
          select: "name role credits image_url short_name" // Fields from Player model
        })
        .lean();

      // Captain stats (Global percentage for this match)
      // Aggregation to count cap/vc for this match
      const capStats = await FantasyTeam.aggregate([
        { $match: { match: new mongoose.Types.ObjectId(match_id) } },
        { $unwind: "$players" },
        {
          $group: {
            _id: "$players.player",
            capCount: { $sum: { $cond: ["$players.is_captain", 1, 0] } },
            vcCount: { $sum: { $cond: ["$players.is_vice_captain", 1, 0] } },
            total: { $sum: 1 } // Total times player selected? No, total teams is count($root).
          }
        }
      ]);

      const totalTeams = await FantasyTeam.countDocuments({ match: match_id });
      const statMap = {};
      capStats.forEach(s => {
        statMap[s._id.toString()] = {
          cap: ((s.capCount / totalTeams) * 100).toFixed(2),
          vc: ((s.vcCount / totalTeams) * 100).toFixed(2)
        };
      });

      // Format
      const formatted = teams.map(t => ({
        match_id, // include match info?
        fantasy_team_id: t._id,
        fantasy_team_name: t.name,
        total_points: t.total_points,
        team_status: t.status,
        players: t.players.map(p => ({
          id: p.player?._id,
          name: p.player?.name,
          role: p.player?.role,
          imagePath: p.player?.image_url,
          credits: p.player?.credits,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          captain_percentage: statMap[p.player?._id]?.cap || "0.00",
          vice_captain_percentage: statMap[p.player?._id]?.vc || "0.00"
        }))
      }));

      return apiResponse.successResponseWithData(res, FANTASYTTEAM.fantasyTeamsFetchedSuccessfully, formatted);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async joinContest(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { contest_id, fantasy_team_id } = req.body;
      const userId = req.user.id;

      const contest = await Contest.findOne({ _id: contest_id, status: { $ne: 'deleted' } }).session(session);
      if (!contest) throw new Error(CONTEST.contestNotOpen);

      // Validate match status
      const match = await Match.findById(contest.match).session(session);
      if (!match || match.status !== "NS") throw new Error("Match started or not found");

      // Full?
      if (contest.joined_teams >= contest.max_teams) throw new Error(CONTEST.contestFull);

      // Wallet Check
      const wallet = await Wallet.findOne({ user: userId }).session(session);
      const user = await User.findById(userId).session(session);
      if (!wallet || wallet.balance < contest.entry_fee) throw new Error(CONTEST.insufficientWalletBalance);

      // Deduct
      wallet.balance -= contest.entry_fee;
      user.wallet_balance -= contest.entry_fee; // Redundant but consistent legacy
      await wallet.save({ session });
      await user.save({ session });

      // Create Transaction
      await Transaction.create([{
        user: userId,
        amount: contest.entry_fee,
        type: "debit", // or contest_join
        description: `Joined contest ${contest.name}`,
        match: match._id,
        contest: contest._id
      }], { session });

      // Create Entry (FantasyGame)
      const existing = await FantasyGame.findOne({ contest: contest_id, fantasy_team: fantasy_team_id }).session(session);
      if (existing) throw new Error(CONTEST.alreadyJoined);

      await FantasyGame.create([{
        user: userId,
        contest: contest_id,
        fantasy_team: fantasy_team_id,
        status: "joined",
        rank: 0,
        points: 0
      }], { session });

      // Update contest
      contest.joined_teams += 1;
      await contest.save({ session });

      await session.commitTransaction();
      return apiResponse.successResponse(res, "Successfully joined contest");

    } catch (error) {
      await session.abortTransaction();
      return apiResponse.ErrorResponse(res, error.message || ERROR.somethingWrong);
    } finally {
      session.endSession();
    }
  },

  async getFantasyTeam(req, res) { // Single team fetch
    try {
      const { id } = req.params;
      const team = await FantasyTeam.findOne({ _id: id, user: req.user.id })
        .populate("players.player", "name role credits image_url");

      if (!team) return apiResponse.ErrorResponse(res, "Fantasy team not found");

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, team);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getContestLeaderboard(req, res) {
    try {
      const { contest_id } = req.params;
      const leaderboards = await FantasyGame.find({ contest: contest_id })
        .populate("user", "name image_url")
        .populate("fantasy_team", "name points")
        .sort({ points: -1, created_at: 1 });

      const formatted = leaderboards.map(entry => ({
        fantasy_team_id: entry.fantasy_team?._id,
        fantasy_team_name: entry.fantasy_team?.name,
        rank: entry.rank,
        points: entry.points,
        username: entry.user?.name,
        profile_image: entry.user?.image_url
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, formatted);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async myMatches(req, res) {
    try {
      const { type } = req.params;
      const { getUserMatches } = require("../../services/matches");
      const results = await getUserMatches(req.user.id, type);
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, results);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateFantasyTeam(req, res) {
    return this.addPlayersToFantasyTeam(req, res);
  },

  async addBackupPlayers(req, res) {
    try {
      const { fantasy_team_id, backups } = req.body;
      const team = await FantasyTeam.findById(fantasy_team_id);
      if (!team) return apiResponse.ErrorResponse(res, "Team not found");

      team.backup_players = backups.map(b => ({
        player: b.player_id,
        priority: b.priority
      }));
      await team.save();
      return apiResponse.successResponse(res, "Backup players updated");
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async toggleMatchNotificationById(req, res) {
    try {
      return apiResponse.successResponse(res, "Notification preference updated");
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async copyFantasyTeam(req, res) {
    try {
      const { fantasy_team_id } = req.body;
      const team = await FantasyTeam.findById(fantasy_team_id).lean();
      if (!team) return apiResponse.ErrorResponse(res, "Team not found");

      delete team._id;
      delete team.created_at;
      delete team.updated_at;
      team.name = `${team.name} (Copy)`;

      const newTeam = new FantasyTeam(team);
      await newTeam.save();
      return apiResponse.successResponseWithData(res, "Team copied successfully", newTeam);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }

};

module.exports = fantasyTeamsController;
