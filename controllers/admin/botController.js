const mongoose = require('mongoose');
const User = require('../../models/User');
const Contest = require('../../models/Contest');
const Match = require('../../models/Match');
const Player = require('../../models/Player');
const PlayerStat = require('../../models/PlayerStat');
const FantasyPoint = require('../../models/FantasyPoint');
const FantasyTeam = require('../../models/FantasyTeam');
const FantasyGame = require('../../models/FantasyGame');
const Tournament = require('../../models/Tournament');
const apiResponse = require('../../utils/apiResponse');
const { ERROR, USER, SUCCESS, CONTEST, FANTASYTTEAM } = require("../../utils/responseMsg");

function generateRandomBangladeshiName() {
  const firstNames = [
    'Arif', 'Rafiq', 'Tanvir', 'Nusrat', 'Sabbir', 'Farhana', 'Hasan', 'Shabnam', 'Jamil', 'Laila',
    'Sakib', 'Taslima', 'Imran', 'Anika', 'Rahman', 'Nabila', 'Fahim', 'Sumaiya', 'Rashed', 'Mousumi'
  ];
  const lastNames = [
    'Hossain', 'Ahmed', 'Chowdhury', 'Karim', 'Rahman', 'Kabir', 'Siddique', 'Islam', 'Bhuiyan', 'Khan',
    'Mia', 'Uddin', 'Biswas', 'Akter', 'Sarker', 'Haque', 'Mustafa', 'Rana', 'Talukder', 'Bappy'
  ];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

async function getOrCreateBotUser() {
  const botEmail = 'bot@mybest11.com';
  let botUser = await User.findOne({ email: botEmail });
  if (!botUser) {
    botUser = new User({
      name: generateRandomBangladeshiName(),
      email: botEmail,
      status: 1,
      is_bot: true,
      wallet_balance: 0,
    });
    await botUser.save();
  }
  return botUser;
}

const botController = {
  async ensureBotWinsContest(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { contest_id } = req.body;
      if (!contest_id) {
        return apiResponse.ErrorResponse(res, 'contest_id is required');
      }

      const contest = await Contest.findById(contest_id).session(session);
      if (!contest) {
        return apiResponse.ErrorResponse(res, 'Contest not found');
      }

      const match_id = contest.match;
      const botUser = await getOrCreateBotUser();

      // 3. Load fantasy point rules and player stats
      const pointRules = await FantasyPoint.find({ status: { $ne: 2 } }).session(session);
      const statsRows = await PlayerStat.find({ match: match_id }).session(session);

      if (!statsRows || statsRows.length === 0) {
        return apiResponse.ErrorResponse(res, 'No match stats found to compute points');
      }

      function computePlayerPointsFromRules(stat, rules) {
        let playerPoints = 0;
        for (const rule of rules) {
          const conditions = rule.conditions || {};
          let matches = true;
          for (const [key, value] of Object.entries(conditions)) {
            if (key.startsWith('min_')) {
              const statKey = key.replace('min_', '');
              if ((stat[statKey] || 0) < value) { matches = false; break; }
            } else if (key === 'status' || key === 'batting_status') {
              const fieldVal = stat.batting_status || '';
              if (String(fieldVal).toLowerCase() !== String(value).toLowerCase()) { matches = false; break; }
            } else if (typeof value === 'number') {
              if ((stat[key] || 0) < value) { matches = false; break; }
            } else if (typeof value === 'string') {
              if (String(stat[key] || '').toLowerCase() !== String(value).toLowerCase()) { matches = false; break; }
            }
          }
          if (matches) playerPoints += Number(rule.points) || 0;
        }
        return playerPoints;
      }

      const playerPointsList = statsRows.map((s) => ({
        player_id: s.player,
        points: computePlayerPointsFromRules(s, pointRules)
      }));

      // 4. Sort and pick candidates
      const rulesCandidates = playerPointsList.sort((a, b) => (b.points || 0) - (a.points || 0));

      const seen = new Set();
      const bestPlayers = [];
      for (const p of rulesCandidates) {
        const pid = p.player_id.toString();
        if (!seen.has(pid)) {
          seen.add(pid);
          bestPlayers.push({ player: p.player_id, points: p.points });
          if (bestPlayers.length === 11) break;
        }
      }

      if (bestPlayers.length < 11) {
        return apiResponse.ErrorResponse(res, 'Not enough unique players to form a team');
      }

      const captainId = bestPlayers[0].player.toString();
      const viceCaptainId = bestPlayers[1].player.toString();

      // 5. Calculate total points
      let calculatedPoints = 0;
      for (const p of bestPlayers) {
        let multiplier = 1;
        if (p.player.toString() === captainId) multiplier = 2;
        else if (p.player.toString() === viceCaptainId) multiplier = 1.5;
        calculatedPoints += (p.points || 0) * multiplier;
      }

      // 6. Ensure bot wins by checking other user points
      const otherUserGames = await FantasyGame.find({ contest: contest_id, user: { $ne: botUser._id } })
        .populate('fantasy_team', 'total_points')
        .session(session);

      const maxUserPoints = Math.max(0, ...otherUserGames.map(g => g.fantasy_team?.total_points || 0));
      const desiredTotal = Math.max(calculatedPoints, maxUserPoints + 1);

      // 7. Insert or update bot's team
      let botTeam = await FantasyTeam.findOne({ user: botUser._id, match: match_id }).session(session);

      const playersData = bestPlayers.map((p) => ({
        player: p.player,
        is_captain: p.player.toString() === captainId,
        is_vice_captain: p.player.toString() === viceCaptainId,
      }));

      if (!botTeam) {
        botTeam = new FantasyTeam({
          user: botUser._id,
          match: match_id,
          name: 'T1',
          total_points: desiredTotal,
          players: playersData,
          status: 1,
        });
      } else {
        botTeam.total_points = desiredTotal;
        botTeam.players = playersData;
        botTeam.status = 1;
      }
      await botTeam.save({ session });

      // 8. Fantasy Game entry
      let botGame = await FantasyGame.findOne({ user: botUser._id, contest: contest_id, fantasy_team: botTeam._id }).session(session);
      if (!botGame) {
        botGame = new FantasyGame({
          user: botUser._id,
          contest: contest_id,
          fantasy_team: botTeam._id,
          team_name_user: 'T1',
        });
        await botGame.save({ session });
        contest.joined_teams += 1;
        await contest.save({ session });
      }

      // Update rank/leaderboard if necessary (Phase 2 uses dynamic rank, but we can store it)
      botGame.rank = 1;
      botGame.points = desiredTotal;
      await botGame.save({ session });

      await session.commitTransaction();
      session.endSession();

      return apiResponse.successResponseWithData(res, 'Bot team inserted/updated and set to win', {
        bot_team_id: botTeam._id,
        totalPoints: desiredTotal,
        maxUserPoints
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Bot ensure win error:', error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  },

  async createBotUser(req, res) {
    try {
      const botUser = new User({
        name: generateRandomBangladeshiName(),
        email: `bot_${Date.now()}@mybest11.com`,
        status: 1,
        is_bot: true,
        wallet_balance: 0,
      });
      await botUser.save();
      return apiResponse.successResponseWithData(res, 'Bot user created', botUser);
    } catch (error) {
      console.error('Error creating bot user:', error);
      return apiResponse.ErrorResponse(res, 'Something went wrong while creating bot user');
    }
  },

  async updateBotUser(req, res) {
    try {
      const { id, status } = req.body;
      if (!id) return apiResponse.ErrorResponse(res, "Bot user ID is required");
      if (![0, 1].includes(Number(status))) return apiResponse.ErrorResponse(res, "Invalid status value. Must be 0 or 1");

      const botUser = await User.findOneAndUpdate(
        { _id: id, is_bot: true },
        { status: Number(status) },
        { new: true }
      );

      if (!botUser) return apiResponse.ErrorResponse(res, "Bot user not found");

      return apiResponse.successResponseWithData(res, "Bot user status updated successfully", botUser);
    } catch (error) {
      console.error("Error updating bot user status:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllBotUser(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "desc",
        status = [],
      } = req.body;

      const filter = { status: { $ne: 2 }, is_bot: true };

      if (status.length > 0) filter.status = { $in: status };
      if (searchItem) {
        filter.$or = [
          { name: { $regex: searchItem, $options: "i" } },
          { email: { $regex: searchItem, $options: "i" } },
          { phone: { $regex: searchItem, $options: "i" } },
        ];
      }

      const limit = parseInt(pageSize);
      const skip = (parseInt(pageNumber) - 1) * limit;

      const totalRecords = await User.countDocuments(filter);
      const result = await User.find(filter)
        .select("id name email phone status is_bot created_at")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
        totalPages: Math.ceil(totalRecords / limit),
        paginated: true,
      });
    } catch (error) {
      console.error("Error in getAllBotUser:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getBotUserById(req, res) {
    try {
      const { id } = req.params;
      const botUser = await User.findOne({ _id: id, is_bot: true })
        .select("id name email phone status is_bot wallet_balance created_at updated_at")
        .lean();

      if (!botUser) return apiResponse.ErrorResponse(res, "Bot user not found");
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, botUser);
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async joinContest(req, res) {
    try {
      const { contest_id, fantasy_team_id, userId, isBot } = req.body;

      if (!contest_id || !fantasy_team_id) return apiResponse.ErrorResponse(res, FANTASYTTEAM.requiredFieldsMissing);

      const contest = await Contest.findOne({ _id: contest_id, status: { $nin: ["completed", "deleted"] } });
      if (!contest) return apiResponse.ErrorResponse(res, CONTEST.contestNotOpen);

      if (contest.joined_teams >= contest.max_teams) return apiResponse.ErrorResponse(res, CONTEST.contestFull);

      const userEntriesCount = await FantasyGame.countDocuments({ contest: contest_id, user: userId });
      if (userEntriesCount >= contest.max_teams_per_user) {
        return apiResponse.ErrorResponse(res, `Limit reached: ${contest.max_teams_per_user} entries.`);
      }

      const fantasyTeam = await FantasyTeam.findOne({ _id: fantasy_team_id, user: userId });
      if (!fantasyTeam) return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFound);

      const existingEntry = await FantasyGame.findOne({ contest: contest_id, user: userId, fantasy_team: fantasy_team_id });
      if (existingEntry) return apiResponse.ErrorResponse(res, CONTEST.alreadyJoined);

      const newEntry = new FantasyGame({
        user: userId,
        contest: contest_id,
        fantasy_team: fantasy_team_id,
      });
      await newEntry.save();

      contest.joined_teams += 1;
      await contest.save();

      return apiResponse.successResponseWithData(res, CONTEST.joinnedContest);
    } catch (error) {
      console.error("Error joining contest:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async createFantasyTeam(req, res) {
    try {
      const { name, userId, match_id, contest_id } = req.body;
      if (!match_id) return apiResponse.ErrorResponse(res, "Match ID is required");

      let fantasyTeam = await FantasyTeam.findOne({ user: userId, match: match_id, status: 0 });
      if (fantasyTeam) {
        return apiResponse.successResponseWithData(res, "Existing draft found", fantasyTeam);
      }

      fantasyTeam = new FantasyTeam({
        user: userId,
        match: match_id,
        name: name || "T1",
        status: 0,
      });
      await fantasyTeam.save();

      return apiResponse.successResponseWithData(res, "Fantasy team draft created", fantasyTeam);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async addPlayersToFantasyTeam(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { fantasy_team_id, players, userId } = req.body;
      if (!fantasy_team_id || !Array.isArray(players)) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, "Invalid request data");
      }

      const team = await FantasyTeam.findOne({ _id: fantasy_team_id, user: userId, status: 0 }).session(session);
      if (!team) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFoundorAlreadySubmitted);
      }

      const captainCount = players.filter((p) => p.is_captain).length;
      const viceCaptainCount = players.filter((p) => p.is_vice_captain).length;
      if (captainCount !== 1 || viceCaptainCount !== 1) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.captainAndViceCaptainRequired);
      }

      // We expect players array to have player IDs (ObjectIds)
      const formattedPlayers = players.map(p => ({
        player: p.player_id,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        substitute: p.substitute || false
      }));

      team.players = formattedPlayers;
      team.status = 1;
      await team.save({ session });

      await session.commitTransaction();
      session.endSession();

      return apiResponse.successResponseWithData(res, FANTASYTTEAM.playersAddedSuccessfully15, team);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding players:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMatchPlayers(req, res) {
    try {
      const { matchId } = req.params;
      const match = await Match.findById(matchId).populate('team1 team2 tournament');
      if (!match) return res.status(404).json({ success: false, message: "Match not found" });

      const tournament = match.tournament;
      // We need seasonId from tournament metadata or similar
      // Logic from Phase 2/SQL used seasonId to filter accurately.

      const players = await Player.find({
        team: { $in: [match.team1?._id, match.team2?._id] }
      }).lean();

      // Aggregate stats / selection % (Phase 2 style)
      // This is a complex aggregation, I'll simplify it for now to return basic player list.
      // In a real scenario, we'd use aggregation to get selection % from all FantasyTeams.

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, players);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async editFantasyTeam(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { fantasy_team_id, players, userId } = req.body;
      if (!fantasy_team_id || !Array.isArray(players)) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, "Invalid request data");
      }

      const team = await FantasyTeam.findOne({ _id: fantasy_team_id, user: userId }).session(session);
      if (!team) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFound);
      }

      const captainCount = players.filter((p) => p.is_captain).length;
      const viceCaptainCount = players.filter((p) => p.is_vice_captain).length;
      if (captainCount !== 1 || viceCaptainCount !== 1) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.captainAndViceCaptainRequired);
      }

      const formattedPlayers = players.map(p => ({
        player: p.player_id,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        substitute: p.substitute || false
      }));

      team.players = formattedPlayers;
      await team.save({ session });

      await session.commitTransaction();
      session.endSession();

      return apiResponse.successResponseWithData(res, FANTASYTTEAM.playersAddedSuccessfully15, team);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error editing fantasy team:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = botController;
