const Users = require('../../models/users');
const { knex: db } = require('../../config/database');
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


// Local utility: Get or create a fixed bot user
async function getOrCreateBotUser(db) {
  const botEmail = 'bot@mybest11.com';
  let botUser = await db('users').where({ email: botEmail }).first();
  if (!botUser) {
    const [created] = await db('users')
      .insert({
        name: generateRandomBangladeshiName(),
        email: botEmail,
        phone: null,
        dob: null,
        gender: null,
        otp: null,
        otp_expires: null,
        is_verified: false,
        is_name_setup: false,
        kyc_verified: false,
        wallet_balance: 0,
        referral_code: null,
        referred_by: null,
        social_login_type: null,
        fb_id: null,
        google_id: null,
        apple_id: null,
        device_id: null,
        device_type: null,
        kyc_document: null,
        status: 1,
        is_reported_Arr: '{}',
        metadata: {},
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
        image_url: null,
        permission: '{}',
        ftoken: null,
        referral_bonus: null,
        is_bot: true
      })
      .returning('*');
    botUser = created;
  }
  return botUser;
}

const botController = {

  async ensureBotWinsContest(req, res) {
    try {
      const { contest_id } = req.body;
      if (!contest_id) {
        return apiResponse.ErrorResponse(res, 'contest_id is required');
      }
      // 1. Get contest and match
      const contest = await db('contests').where({ id: contest_id }).first();
      if (!contest) {
        return apiResponse.ErrorResponse(res, 'Contest not found');
      }
      const match_id = contest.match_id;
      // 2. Get or create bot user (local)
      const botUser = await getOrCreateBotUser(db);

      // 3. Load fantasy point rules and all match stats for this match
      const pointRules = await db('fantasy_points').select('*');
      const statsRows = await db('match_stats').where({ match_id });
      if (!statsRows || statsRows.length === 0) {
        return apiResponse.ErrorResponse(res, 'No match stats found to compute points');
      }

      // 4. Compute per-player points from rules and stats
      function computePlayerPointsFromRules(stat, rules) {
        let playerPoints = 0;
        for (const rule of rules) {
          const conditions = rule.conditions || {};
          let matches = true;
          for (const [key, value] of Object.entries(conditions)) {
            if (key.startsWith('min_')) {
              const statKey = key.replace('min_', '');
              if (((stat && stat[statKey]) || 0) < value) { matches = false; break; }
            } else if (key === 'status' || key === 'batting_status') {
              const fieldVal = (stat && (stat.batting_status || stat.status)) || '';
              if (String(fieldVal).toLowerCase() !== String(value).toLowerCase()) { matches = false; break; }
            } else if (typeof value === 'number') {
              if (((stat && stat[key]) || 0) < value) { matches = false; break; }
            } else if (typeof value === 'string') {
              if (String((stat && stat[key]) || '').toLowerCase() !== String(value).toLowerCase()) { matches = false; break; }
            }
          }
          if (matches) playerPoints += Number(rule.points) || 0;
        }
        return playerPoints;
      }

      const playerPointsList = statsRows.map((s) => ({
        player_id: s.player_id,
        points: computePlayerPointsFromRules(s, pointRules)
      }));

      // 5. Sort and pick candidates
      const rulesCandidates = playerPointsList
        .sort((a, b) => (b.points || 0) - (a.points || 0));

      // Fallback: If not enough players from rules-based scoring, gather fallback candidates
      let fallbackCandidates = [];
      if (!rulesCandidates || rulesCandidates.length < 11) {
        const matchRow = await db('matches')
          .select('team1_id', 'team2_id')
          .where({ id: match_id })
          .first();
        if (!matchRow) {
          return apiResponse.ErrorResponse(res, 'Match not found for fallback selection');
        }
        fallbackCandidates = await db('players as p')
          .join('player_teams as pt', 'p.id', 'pt.player_id')
          .whereIn('pt.team_id', [matchRow.team1_id, matchRow.team2_id])
          .orderBy('p.points', 'desc')
          .select('p.id as player_id', db.raw('COALESCE(p.points, 0) as points'));
      }

      // Build bestPlayers = 11 unique players by player_id using rules first then fallback
      const seen = new Set();
      const bestPlayers = [];
      function pushUnique(list) {
        for (const p of list) {
          const pid = Number(p.player_id);
          if (!seen.has(pid)) {
            seen.add(pid);
            bestPlayers.push({ player_id: pid, points: Number(p.points) || 0 });
            if (bestPlayers.length === 11) break;
          }
        }
      }
      pushUnique(rulesCandidates || []);
      if (bestPlayers.length < 11) pushUnique(fallbackCandidates || []);

      if (bestPlayers.length < 11) {
        return apiResponse.ErrorResponse(res, 'Not enough unique players to form a team');
      }

      const captainId = bestPlayers[0].player_id;
      const viceCaptainId = bestPlayers[1].player_id;

      // 6. Calculate total points for this team (with multipliers)
      let totalPoints = 0;
      for (const p of bestPlayers) {
        let multiplier = 1;
        if (p.player_id === captainId) multiplier = 2;
        else if (p.player_id === viceCaptainId) multiplier = 1.5;
        totalPoints += (Number(p.points) || 0) * multiplier;
      }

      // 7. Find the highest points among real users (optional check, not used for logic)
      const maxUserPointsRow = await db('fantasy_teams')
        .join('fantasy_games', 'fantasy_teams.id', 'fantasy_games.fantasy_team_id')
        .where('fantasy_games.contest_id', contest_id)
        .whereNot('fantasy_teams.user_id', botUser.id)
        .max('fantasy_teams.total_points as max')
        .first();
      const maxUserPoints = Number(maxUserPointsRow?.max) || 0;
      const desiredTotal = maxUserPoints + 1; // ensure bot is always +1 over highest

      // 8. Insert or update bot's team
      let botTeam = await db('fantasy_teams')
        .where({ user_id: botUser.id, match_id })
        .first();
      if (!botTeam) {
        const [newTeam] = await db('fantasy_teams')
          .insert({
            user_id: botUser.id,
            match_id,
            name: 'T1',
            total_points: desiredTotal,
            status: 1,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning('*');
        botTeam = newTeam;
        const playersData = bestPlayers.map((p) => ({
          fantasy_team_id: botTeam.id,
          player_id: p.player_id,
          role: null,
          is_captain: p.player_id === captainId,
          is_vice_captain: p.player_id === viceCaptainId,
          substitute: false,
          created_at: db.fn.now(),
        }));
        await db('fantasy_team_players').insert(playersData);
      } else {
        await db('fantasy_teams').where({ id: botTeam.id }).update({ total_points: desiredTotal, updated_at: db.fn.now() });
        await db('fantasy_team_players').where({ fantasy_team_id: botTeam.id }).del();
        const playersData = bestPlayers.map((p) => ({
          fantasy_team_id: botTeam.id,
          player_id: p.player_id,
          role: null,
          is_captain: p.player_id === captainId,
          is_vice_captain: p.player_id === viceCaptainId,
          substitute: false,
          created_at: db.fn.now(),
        }));
        await db('fantasy_team_players').insert(playersData);
      }

      // 9. Insert or update fantasy_games entry for bot
      let botGame = await db('fantasy_games')
        .where({ user_id: botUser.id, contest_id, fantasy_team_id: botTeam.id })
        .first();
      if (!botGame) {
        const [insertedGame] = await db('fantasy_games').insert({
          user_id: botUser.id,
          contest_id,
          fantasy_team_id: botTeam.id,
          team_name_user: 'T1',
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        }).returning('*');
        botGame = insertedGame;
        await db('contests').where({ id: contest_id }).increment('filled_spots', 1);
      }

      // 10. Update leaderboard for bot
      let botLb = await db('leaderboard')
        .where({ contestId: contest_id, userId: botUser.id })
        .first();
      if (!botLb) {
        await db('leaderboard').insert({
          contestId: contest_id,
          userId: botUser.id,
          fantasyGameId: botGame?.id,
          tournamentId: contest.tournament_id,
          matchId: match_id,
          totalScore: desiredTotal,
          rank: 1,
          is_finalized: true,
          created_at: db.fn.now(),
          modified_at: db.fn.now(),
        });
      } else {
        await db('leaderboard').where({ id: botLb.id }).update({ totalScore: desiredTotal, rank: 1, modified_at: db.fn.now() });
      }

      // Re-read team's persisted total_points to ensure response consistency
      const botTeamFresh = await db('fantasy_teams').where({ id: botTeam.id }).first();
      const persistedTotal = Number(botTeamFresh?.total_points) || 0;

      return apiResponse.successResponseWithData(res, 'Bot team inserted/updated and set to win', { bot_team_id: botTeam.id, totalPoints: persistedTotal, maxUserPoints });
    } catch (error) {
      console.error('Bot ensure win error:', error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  },

  async createBotUser(req, res) {
    try {
      const [created] = await db('users')
        .insert({
          name: generateRandomBangladeshiName(),
          email: `bot_${Date.now()}@mybest11.com`,
          phone: null,
          dob: null,
          gender: null,
          otp: null,
          otp_expires: null,
          is_verified: false,
          is_name_setup: false,
          kyc_verified: false,
          wallet_balance: 0,
          referral_code: null,
          referred_by: null,
          social_login_type: null,
          fb_id: null,
          google_id: null,
          apple_id: null,
          device_id: null,
          device_type: null,
          kyc_document: null,
          status: 1,
          is_reported_Arr: '{}',

          metadata: {},
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
          image_url: null,
          permission: '{}',
          ftoken: null,
          referral_bonus: null,
          is_bot: true
        })
        .returning('*');
      return apiResponse.successResponseWithData(res, 'Bot user created', created);
    } catch (error) {
      console.error('Error creating bot user:', error);
      return apiResponse.ErrorResponse(res, 'Something went wrong while creating bot user');
    }
  },
  async updateBotUser(req, res) {
    try {
      const { id, status } = req.body;
  
      if (!id) {
        return apiResponse.ErrorResponse(res, "Bot user ID is required");
      }
  
      if (![0, 1].includes(Number(status))) {
        return apiResponse.ErrorResponse(res, "Invalid status value. Must be 0 or 1");
      }
  
      // Find bot user
      const botUser = await db("users").where({ id, is_bot: true }).first();
      if (!botUser) {
        return apiResponse.ErrorResponse(res, "Bot user not found");
      }
  
      // Update status
      await db("users").where({ id }).update({ status: Number(status), updated_at: db.fn.now() });
  
      return apiResponse.successResponseWithData(res, "Bot user status updated successfully", {
        id,
        status: Number(status),
      });
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
  
      pageSize = parseInt(pageSize);
      pageNumber = parseInt(pageNumber);
  
      let baseQuery = db("users").whereNot("status", 2).where("is_bot", true);
  
      // Filter by status
      if (status.length > 0) {
        baseQuery.andWhere((qb) => qb.whereIn("status", status));
      }
  
      // Search filter
      if (searchItem) {
        baseQuery.andWhere((builder) =>
          builder
            .whereILike("name", `%${searchItem}%`)
            .orWhereILike("email", `%${searchItem}%`)
            .orWhereILike("phone", `%${searchItem}%`)
        );
      }
  
      // Count total records
      const totalRecordsResult = await baseQuery.clone().count({ count: "*" }).first();
      const totalRecords = parseInt(totalRecordsResult.count);
  
      // Apply pagination
      const result = await baseQuery
        .clone()
        .select("id", "name", "email", "phone", "status", "is_bot", "created_at")
        .orderBy(sortBy, sortOrder)
        .limit(pageSize)
        .offset((pageNumber - 1) * pageSize);
  
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords,
        pageNumber,
        pageSize,
        totalPages: Math.ceil(totalRecords / pageSize),
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
  
      if (!id) {
        return apiResponse.ErrorResponse(res, "Bot user ID is required");
      }
  
      const botUser = await db("users")
        .select(
          "id",
          "name",
          "email",
          "phone",
          "status",
          "is_bot",
          "wallet_balance",
          "created_at",
          "updated_at"
        )
        .where({ id, is_bot: true })
        .first();
  
      if (!botUser) {
        return apiResponse.ErrorResponse(res, "Bot user not found");
      }
  
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, botUser);
    } catch (error) {
      console.error("Error fetching bot user by ID:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  

  async joinContest(req, res) {
    try {
      const { contest_id, fantasy_team_id, userId, isBot } = req.body; // add isBot flag
  
     
  
      if (!contest_id || !fantasy_team_id) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.requiredFieldsMissing);
      }
  
      const contest = await db("contests")
        .where("id", contest_id)
        .where("status", "!=", "completed")
        .where("status", "!=", "deleted")
        .first();
  
      if (!contest) {
        return apiResponse.ErrorResponse(res, CONTEST.contestNotOpen);
      }
  
      if (contest.filled_spots >= contest.total_spots) {
        return apiResponse.ErrorResponse(res, CONTEST.contestFull);
      }
  
      const match = await db("matches").where("id", contest.match_id).first();
      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found");
      }
  
      const userEntries = await db("fantasy_games")
        .where("contest_id", contest_id)
        .where("user_id", userId)
        .count("id as count")
        .first();
  
      if (userEntries.count >= contest.per_user_entry) {
        return apiResponse.ErrorResponse(
          res,
          `You can only join this contest ${contest.per_user_entry} time(s)`
        );
      }
  
      // Only check wallet for real users, skip for bot users
      if (!isBot) {
        const wallet = await db("wallet").where({ user_id: userId }).first();
        if (!wallet || parseFloat(wallet.balance) < parseFloat(contest.entry_fee)) {
          return apiResponse.ErrorResponse(res, CONTEST.insufficientWalletBalance);
        }
      }
  
      // Validate fantasy team ownership
      const fantasyTeam = await db("fantasy_teams")
        .where("id", fantasy_team_id)
        .andWhere("user_id", userId)
        .first();
  
      if (!fantasyTeam) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFound);
      }
  
      // Prevent duplicate join
      const existingEntry = await db("fantasy_games")
        .where({ contest_id, user_id: userId, fantasy_team_id })
        .first();
  
      if (existingEntry) {
        return apiResponse.ErrorResponse(res, CONTEST.alreadyJoined);
      }
  
      // ✅ Bot users join without wallet deduction
      await db("fantasy_games").insert({
        user_id: userId,
        contest_id,
        fantasy_team_id,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
  
      await db("contests").where("id", contest_id).increment("filled_spots", 1);
  
      return apiResponse.successResponseWithData(res, CONTEST.joinnedContest);
    } catch (error) {
      console.error("Error joining contest:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  

  async createFantasyTeam(req, res) {
    try {
      const { name,userId,match_id, contest_id } = req.body;

    

      // Validate required fields
      if (!match_id) {
        return apiResponse.ErrorResponse(res, "Contest ID is required");
      }

      const existingTeam = await db('fantasy_teams')
        .where('user_id', userId)
        .whereNotIn('status', [1, 2])
        .first();

      if (existingTeam) {
        return apiResponse.successResponseWithData(res, "Existing fantasy team found", existingTeam);
      } else {
        // Create fantasy team
        const [fantasyTeam] = await db('fantasy_teams')
          .insert({
            user_id: userId,
            match_id,
            name,
            contest_id,
            total_points: 0,
            status: 0,
           
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning('*');

          

        return apiResponse.successResponseWithData(res, "Fantasy team created successfully", fantasyTeam);
      }
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async addPlayersToFantasyTeam(req, res) {
    const trx = await db.transaction();
    try {
      const { fantasy_team_id, players, userId } = req.body;
    
  
      if (!fantasy_team_id || !players || !Array.isArray(players)) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, "Invalid request data");
      }
  
      // ✅ Validate fantasy team belongs to user & not already submitted
      const team = await trx("fantasy_teams")
        .where({ id: fantasy_team_id, user_id: userId, status: 0 })
        .first();
  
      if (!team) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.fantasyTeamNotFoundorAlreadySubmitted
        );
      }
  
      // ✅ Fetch match info
      const match = await trx("matches")
        .where("id", team.match_id)
        .select("team1_id", "team2_id", "tournament_id")
        .first();
  
      if (!match) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.associatedMatchNotFound
        );
      }
  
      // ✅ Ensure exactly 1 Captain & 1 Vice Captain
      const captainCount = players.filter((p) => p.is_captain).length;
      const viceCaptainCount = players.filter((p) => p.is_vice_captain).length;
      if (captainCount !== 1 || viceCaptainCount !== 1) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.captainAndViceCaptainRequired
        );
      }
  
      // ✅ Map external player_id → internal DB id
      const externalIds = players.map((p) => p.player_id);
      const dbPlayers = await trx("players")
        .whereIn("player_id", externalIds)
        .select("id", "player_id");
  
      const playerIdMap = {};
      dbPlayers.forEach((p) => {
        playerIdMap[p.player_id] = p.id;
      });
  
      // Check if any invalid player_ids
      const invalidPlayers = externalIds.filter((pid) => !playerIdMap[pid]);
      if (invalidPlayers.length > 0) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          `${FANTASYTTEAM.invalidPlayersForThisMatch}: ${invalidPlayers.join(",")}`
        );
      }
  
      // ✅ Prepare players for insertion
      const formattedPlayers = players.map((p) => ({
        fantasy_team_id,
        player_id: playerIdMap[p.player_id], // Use internal DB ID
        role: p.role || null,
        is_captain: Boolean(p.is_captain),
        is_vice_captain: Boolean(p.is_vice_captain),
        substitute: Boolean(p.substitute),
        created_at: db.fn.now(),
      }));
  
      const playerIds = formattedPlayers.map((p) => p.player_id);
  
      // ✅ Prevent duplicates
      const existingPlayers = await trx("fantasy_team_players")
        .where("fantasy_team_id", fantasy_team_id)
        .whereIn("player_id", playerIds);
  
      if (existingPlayers.length > 0) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          `${FANTASYTTEAM.duplicatePlayersFound}: ${existingPlayers
            .map((p) => p.player_id)
            .join(",")}`
        );
      }
  
      // ✅ Insert players
      const inserted = await trx("fantasy_team_players")
        .insert(formattedPlayers)
        .returning("*");
  
      // ✅ Mark team as submitted
      await trx("fantasy_teams")
        .where({ id: fantasy_team_id })
        .update({ status: 1, updated_at: db.fn.now() });
  
      await trx.commit();
  
      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.playersAddedSuccessfully15,
        inserted
      );
    } catch (error) {
      console.error("Error adding players:", error);
      await trx.rollback();
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  
  
  
  

  async getMatchPlayers(req, res) {
    try {
      const { matchId } = req.params;

      const match = await db("matches")
        .select(
          "matches.id",
          "matches.team1_id",
          "matches.team2_id",
          "t1.name as team1_name",
          "t1.short_name as team1_short_name",
          "t2.name as team2_name",
          "t2.short_name as team2_short_name",
          "matches.tournament_id"
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .where("matches.id", matchId)
        .first();

      if (!match) {
        return res
          .status(404)
          .json({ success: false, message: "Match not found" });
      }

      const tournament = await db("tournaments")
        .select("tournaments.id", "tournaments.metadata")
        .where("tournaments.id", match.tournament_id)
        .first();

      const metadata = typeof tournament.metadata === "string"
        ? JSON.parse(tournament.metadata)
        : tournament.metadata;




      const seasonId = metadata.season_id;

      const players = await db("players")
        .select(
          "players.id",
          "players.name",
          "players.player_id",
          "players.role",
          "players.points",
          "players.credits",
          "players.metadata",
          "players.is_played_last_match",
          "players.selected_by_percentage",
          "teams.id as team_id",
          "teams.name as team_name"
        )
        .leftJoin("player_teams", "players.id", "player_teams.player_id")
        .leftJoin("teams", "player_teams.team_id", "teams.id")
        .whereIn("player_teams.team_id", [match.team1_id, match.team2_id])
        .andWhere("player_teams.season_id", seasonId) // This is CRITICAL
        .groupBy("players.id", "teams.id") // Add grouping to prevent duplicates //
        .orderBy(["teams.name", "players.name"]);

      const totalTeams = await db("fantasy_teams")
        .where("match_id", matchId)
        .count("id as count")
        .first();

      const totalTeamsCount = parseInt(totalTeams.count) || 1;

      const playerIds = players.map((p) => p.id);

      const substituteStatus = await db("fantasy_team_players as ftp")
        .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
        .where("ft.match_id", matchId)
        .whereIn("ftp.player_id", playerIds)
        .select("ftp.player_id", "ftp.substitute")
        .groupBy("ftp.player_id", "ftp.substitute");

      const substituteMap = {};
      substituteStatus.forEach((stat) => {
        substituteMap[stat.player_id] = stat.substitute;
      });

      const capVcStatsArr = await db("fantasy_team_players as ftp")
        .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
        .leftJoin(
          "fantasy_games as fg",
          "ftp.fantasy_team_id",
          "fg.fantasy_team_id"
        )
        .where("ft.match_id", matchId)
        .whereIn("ftp.player_id", playerIds)
        .select(
          "ftp.player_id",
          db.raw(
            "SUM(CASE WHEN ftp.is_captain THEN 1 ELSE 0 END) as captain_count"
          ),
          db.raw(
            "SUM(CASE WHEN ftp.is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
          ),
          db.raw(
            "COUNT(DISTINCT CASE WHEN ftp.is_captain OR ftp.is_vice_captain THEN fg.contest_id END) as contest_count"
          )
        )
        .groupBy("ftp.player_id");

      const capVcStats = {};
      capVcStatsArr.forEach((stat) => {
        capVcStats[stat.player_id] = {
          captain_count: parseInt(stat.captain_count) || 0,
          vice_captain_count: parseInt(stat.vice_captain_count) || 0,
          contest_count: parseInt(stat.contest_count) || 0,
        };
      });

      const teamPlayers = {
        [match.team1_name]: [],
        [match.team2_name]: [],
      };

      players.forEach((player) => {
        const teamName = player.team_name;
        const stats = capVcStats[player.id] || {
          captain_count: 0,
          vice_captain_count: 0,
          contest_count: 0,
        };
        let team_short_name = null;
        if (teamName === match.team1_name) {
          team_short_name = match.team1_short_name;
        } else if (teamName === match.team2_name) {
          team_short_name = match.team2_short_name;
        }
        teamPlayers[teamName].push({
          id: player.id,
          name: player.name,
          player_id: player.player_id,
          role: player.role,
          points: player.points,
          credits: player.credits,
          imagePath: player.metadata?.image_path || null,
          isPlayedLastMatch: player.is_played_last_match,
          selectedByPercentage: player.selected_by_percentage,
          captain_percentage: Math.floor(
            (stats.captain_count / totalTeamsCount) * 100
          ).toFixed(2),
          vice_captain_percentage: Math.floor(
            (stats.vice_captain_count / totalTeamsCount) * 100
          ).toFixed(2),
          contest_count: stats.contest_count,
          substitute: substituteMap[player.id] || false,
          team_short_name,
          team: teamName,
        });
      });

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        match_id: match.id,
        teams: {
          [match.team1_name]: teamPlayers[match.team1_name],
          [match.team2_name]: teamPlayers[match.team2_name],
        },
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async editFantasyTeam(req, res) {
    const trx = await db.transaction();
    try {
      const { fantasy_team_id, players, user_id } = req.body;
     
  
      if (!fantasy_team_id || !players || !Array.isArray(players)) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, "Invalid request data");
      }
  
      // Determine user/admin
      const isAdmin = req.user && req.user.role === "admin";
      const userId = isAdmin ? user_id : req.user.id;
      if (isAdmin && !userId) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, "User ID is required when admin is editing team");
      }
  
      // Get team
      const team = await trx("fantasy_teams")
        .where({ id: fantasy_team_id, user_id: userId })
        .first();
  
      if (!team) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFoundorAlreadySubmitted);
      }
  
      // Check if match already started (only for non-admins)
      if (!isAdmin) {
        const match = await trx("matches")
          .where("id", team.match_id)
          .select("status", "start_time")
          .first();
  
        const nowUtc = new Date();
        if (
          (match.status && match.status !== "NS") ||
          (match.start_time && new Date(match.start_time) <= nowUtc)
        ) {
          await trx.rollback();
          return apiResponse.ErrorResponse(res, "Cannot edit team after match started");
        }
      }
  
      // Ensure exactly 1 Captain & 1 Vice Captain
      const captainCount = players.filter((p) => p.is_captain).length;
      const viceCaptainCount = players.filter((p) => p.is_vice_captain).length;
      if (captainCount !== 1 || viceCaptainCount !== 1) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.captainAndViceCaptainRequired);
      }
  
      // Map external player_id → internal DB id
      const externalIds = players.map((p) => p.player_id);
      const dbPlayers = await trx("players")
        .whereIn("player_id", externalIds)
        .select("id", "player_id");
  
      const playerIdMap = {};
      dbPlayers.forEach((p) => {
        playerIdMap[p.player_id] = p.id;
      });
  
      // Check for invalid players
      const invalidPlayers = externalIds.filter((pid) => !playerIdMap[pid]);
      if (invalidPlayers.length > 0) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          `${FANTASYTTEAM.invalidPlayersForThisMatch}: ${invalidPlayers.join(",")}`
        );
      }
  
      // Format players for insertion
      const formattedPlayers = players.map((p) => ({
        fantasy_team_id,
        player_id: playerIdMap[p.player_id],
        role: p.role || null,
        is_captain: Boolean(p.is_captain),
        is_vice_captain: Boolean(p.is_vice_captain),
        substitute: Boolean(p.substitute),
        created_at: db.fn.now(),
      }));
  
      // Delete old players
      await trx("fantasy_team_players")
        .where("fantasy_team_id", fantasy_team_id)
        .del();
  
      // Insert new players
      const inserted = await trx("fantasy_team_players")
        .insert(formattedPlayers)
        .returning("*");
  
      // Update team status
      await trx("fantasy_teams")
        .where({ id: fantasy_team_id })
        .update({ status: 1, updated_at: db.fn.now() });
  
      await trx.commit();
  
      return apiResponse.successResponseWithData(
        res,
        "Fantasy team updated successfully",
        inserted
      );
    } catch (error) {
      await trx.rollback();
      console.error("Error editing team:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  

};

module.exports = botController;
