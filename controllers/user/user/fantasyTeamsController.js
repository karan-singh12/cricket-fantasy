const config = require("../../config/config");
const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const {
  ERROR,
  SUCCESS,
  FANTASYTTEAM,
  CONTEST,
} = require("../../utils/responseMsg");
const moment = require("moment");

async function calculateFantasyTeamPoints(fantasyTeamId, matchId, db) {
  const pointRules = await db("fantasy_points").select("*");

  const players = await db("fantasy_team_players as ftp")
    .join("players as p", "ftp.player_id", "p.id")
    .select(
      "ftp.player_id",
      "ftp.is_captain",
      "ftp.is_vice_captain",
      "ftp.substitute",
      "p.name as player_name"
    )
    .where("ftp.fantasy_team_id", fantasyTeamId);

  let teamPoints = 0;

  for (const player of players) {
    const stats = await db("match_stats")
      .where({ match_id: matchId, player_id: player.player_id })
      .first();
    if (!stats) {
      console.warn(
        `No stats found for ${player.player_name} (player_id: ${player.player_id})`
      );
      continue;
    }

    let playerPoints = 0;
    for (const rule of pointRules) {
      const conditions = rule.conditions || {}; // JSONB field – already parsed
      let matches = true;
      for (const [key, value] of Object.entries(conditions)) {
        if (key.startsWith("min_")) {
          const statKey = key.replace("min_", "");
          if ((stats[statKey] || 0) < value) {
            matches = false;
            break;
          }
        } else if (key === "status" || key === "batting_status") {
          const fieldVal = stats.batting_status || stats.status;
          if ((fieldVal || "").toLowerCase() !== value.toLowerCase()) {
            matches = false;
            break;
          }
        } else if (typeof value === "number") {
          if ((stats[key] || 0) < value) {
            matches = false;
            break;
          }
        } else if (typeof value === "string") {
          if ((stats[key] || "").toLowerCase() !== value.toLowerCase()) {
            matches = false;
            break;
          }
        }
      }
      if (matches) {
        playerPoints += rule.points;
        console.log(
          `Rule matched for ${player.player_name}: ${rule.action} (+${rule.points} pts)`
        );
      }
    }
    if (player.is_captain) {
      playerPoints *= 2;
    } else if (player.is_vice_captain) {
      playerPoints *= 1.5;
    }

    teamPoints += playerPoints;
  }

  await db("fantasy_teams")
    .where("id", fantasyTeamId)
    .update({ total_points: teamPoints });

  return teamPoints;
}

const contestController = {
  async createFantasyTeam(req, res) {
    try {
      const userId = req.user.id;
      const { match_id, name, metadata } = req.body;

      if (!match_id) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.Matchidrequired);
      }

      const matchStarted = await db("matches")
        .where("id", match_id)
        .whereIn("status", [
          // Live/started phases
          "1st Innings",
          "2nd Innings",
          "3rd Innings",
          "4th Innings",
          "Stump Day 1",
          "Stump Day 2",
          "Stump Day 3",
          "Stump Day 4",
          "Innings Break",
          "Tea Break",
          "Lunch",
          "Dinner",
          "Live",
          // Interrupted/abandoned imply match has begun
          "Int.",
          "Aban.",
          // Completed/finished
          "Finished",
          "Completed",
        ])
        .first();

      if (matchStarted) {
        return apiResponse.ErrorResponse(
          res,
          "Match started, cannot create team"
        );
      }

      const existingTeam = await db("fantasy_teams")
        .where("user_id", userId)
        .where("match_id", match_id)
        .whereNotIn("status", [1, 2])
        .first();

      if (existingTeam) {
        return apiResponse.successResponseWithData(
          res,
          FANTASYTTEAM.fantasyTeamAlreadyExists,
          existingTeam
        );
      }
      const fantasyTeam = await db.transaction(async (trx) => {
        const [newTeam] = await trx("fantasy_teams")
          .insert({
            user_id: userId,
            match_id,
            name,
            total_points: 0,
            status: 0,
            metadata: metadata ? JSON.stringify(metadata) : null,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning("*");

        return newTeam;
      });

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyTeamCreated,
        fantasyTeam
      );
    } catch (error) {
      console.error("Create team error:", error);
      return apiResponse.ErrorResponse(
        res,
        FANTASYTTEAM.failedtocreatefantasyteam
      );
    }
  },

  async addPlayersToFantasyTeam(req, res) {
    const trx = await db.transaction();
    try {
      const userId = req.user.id;
      const { fantasy_team_id, players } = req.body;

      if (!fantasy_team_id || !players || !Array.isArray(players)) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, "Invalid request data");
      }

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

      const match = await trx("matches")
        .where("id", team.match_id)
        .select("team1_id", "team2_id", "status", "start_time", "tournament_id")
        .first();

      if (!match) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.associatedMatchNotFound
        );
      }

      // Lock if match has started
      const nowUtc = new Date();
      if (
        (match.status && match.status !== "NS") ||
        (match.start_time && new Date(match.start_time) <= nowUtc)
      ) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          "Team edits are locked as the match has started"
        );
      }

      const captainCount = players.filter((p) => p.is_captain).length;
      const viceCaptainCount = players.filter((p) => p.is_vice_captain).length;

      if (captainCount !== 1 || viceCaptainCount !== 1) {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.captainAndViceCaptainRequired
        );
      }

      const playerIds = players.map((p) => p.player_id);
      const formattedPlayers = players.map((p) => ({
        fantasy_team_id,
        player_id: p.player_id,
        role: p.role || null,
        is_captain: Boolean(p.is_captain),
        substitute: Boolean(p.substitute),
        is_vice_captain: Boolean(p.is_vice_captain),
        created_at: db.fn.now(),
      }));

      // If lineup is announced, restrict to playing XI only
      const lineupExists = await trx("match_players")
        .where({ match_id: team.match_id })
        .andWhere(function () {
          this.where("is_playing_xi", true).orWhere("is_substitute", true);
        })
        .first();

      if (lineupExists) {
        const allowedPlayingDbIds = await trx("match_players as mp")
          .where({ match_id: team.match_id })
          .andWhere("is_playing_xi", true)
          .pluck("player_id");
        const allowedSet = new Set(allowedPlayingDbIds.map(Number));
        const invalid = playerIds.filter((pid) => !allowedSet.has(Number(pid)));
        if (invalid.length) {
          await trx.rollback();
          return apiResponse.ErrorResponse(
            res,
            "Lineup announced. You can only select players from the Playing XI"
          );
        }
      }

      // Validate player belongs to match teams (squad membership) for the same season
      // Resolve seasonId for the match's tournament
      let seasonIdForMatch = null;
      try {
        if (match && match.tournament_id) {
          const tournamentRow = await trx("tournaments")
            .select("metadata", "season")
            .where({ id: match.tournament_id })
            .first();
          if (tournamentRow) {
            if (tournamentRow.season) seasonIdForMatch = tournamentRow.season;
            if (!seasonIdForMatch && tournamentRow.metadata) {
              const meta =
                typeof tournamentRow.metadata === "string"
                  ? JSON.parse(tournamentRow.metadata)
                  : tournamentRow.metadata;
              seasonIdForMatch = meta?.season_id || null;
            }
          }
        }
      } catch (_e) {
        // ignore, fallback to non-season filtered validation below
      }

      const validPlayersRows = await trx("player_teams as pt")
        .whereIn("pt.player_id", playerIds)
        .andWhere(function () {
          this.where("pt.team_id", match.team1_id).orWhere(
            "pt.team_id",
            match.team2_id
          );
        })
        .modify((qb) => {
          if (seasonIdForMatch) qb.andWhere("pt.season_id", seasonIdForMatch);
        })
        .distinct("pt.player_id");

      const validSet = new Set(
        validPlayersRows.map((r) => Number(r.player_id))
      );
      const requestedSet = new Set(playerIds.map((id) => Number(id)));
      const invalid = Array.from(requestedSet).filter(
        (id) => !validSet.has(id)
      );

      if (invalid.length) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.invalidPlayersForThisMatch
        );
      }

      // Check for duplicates
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

      const inserted = await trx("fantasy_team_players")
        .insert(formattedPlayers)
        .returning("*");
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
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMyAllTeams(req, res) {
    try {
      const userId = req.user.id;
      const { match_id } = req.body;

      if (!match_id) {
        return apiResponse.ErrorResponse(res, ERROR.matchIdRequired);
      }

      // Get match info
      const match = await db("matches as m")
        .select(
          "m.id as match_id",
          "t1.id as team1_id",
          "t2.id as team2_id",
          "t1.short_name as team1_short_name",
          "t2.short_name as team2_short_name",
          "t1.logo_url as team1_image",
          "t2.logo_url as team2_image"
        )
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .where("m.id", match_id)
        .first();

      if (!match) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.matchNotFound);
      }

      // Resolve season for this match's tournament to avoid duplicate player_teams joins
      let seasonIdForMatch = null;
      try {
        const matchRow = await db("matches")
          .select("tournament_id")
          .where({ id: match_id })
          .first();
        if (matchRow?.tournament_id) {
          const tRow = await db("tournaments")
            .select("season", "metadata")
            .where({ id: matchRow.tournament_id })
            .first();
          if (tRow) {
            seasonIdForMatch = tRow.season || null;
            if (!seasonIdForMatch && tRow.metadata) {
              const meta =
                typeof tRow.metadata === "string"
                  ? JSON.parse(tRow.metadata)
                  : tRow.metadata;
              seasonIdForMatch = meta?.season_id || null;
            }
          }
        }
      } catch (_e) {}

      // Get teams with player data (season-scoped to prevent duplicates)
      const teams = await db("fantasy_teams as ft")
        .select(
          "ft.id as fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points",
          "ft.status as team_status",
          "ftp.id as ftp_row_id",
          "ftp.player_id",
          "ftp.is_captain",
          "ftp.is_vice_captain",
          "ftp.substitute",
          "p.name as player_name",
          "p.role as player_role",
          "pt.team_id as player_team_id",
          "t.name as player_team_name",
          "p.credits as player_credits",
          "t.short_name as player_team_short_name",
          db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
        )
        .distinct(["ft.id", "ftp.player_id", "pt.team_id"]) // collapse duplicate player_teams rows
        .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
        .join("players as p", "ftp.player_id", "p.id")
        .join("player_teams as pt", function () {
          this.on("p.id", "pt.player_id");
          if (seasonIdForMatch)
            this.andOn("pt.season_id", db.raw("?", [seasonIdForMatch]));
        })
        .leftJoin("teams as t", "pt.team_id", "t.id")
        .where("ft.user_id", userId)
        .where("ft.match_id", match_id)
        .whereIn("pt.team_id", [match.team1_id, match.team2_id])
        .orderBy("ftp.substitute", "asc")
        .orderBy("ftp_row_id", "asc");

      if (teams.length === 0) {
        return apiResponse.successResponseWithData(
          res,
          FANTASYTTEAM.noTeamsFound,
          []
        );
      }

      // Calculate captain stats
      const totalTeamsCount = await db("fantasy_teams")
        .where("match_id", match_id)
        .countDistinct("id")
        .first()
        .then((res) => Number(res.count) || 1);

      const capStats = await db("fantasy_team_players as ftp")
        .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
        .where("ft.match_id", match_id)
        .groupBy("ftp.player_id")
        .select(
          "ftp.player_id",
          db.raw(
            "SUM(CASE WHEN is_captain THEN 1 ELSE 0 END) as captain_count"
          ),
          db.raw(
            "SUM(CASE WHEN is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
          )
        );

      const capStatsMap = capStats.reduce((acc, stat) => {
        acc[stat.player_id] = {
          cap: ((stat.captain_count / totalTeamsCount) * 100).toFixed(2),
          vc: ((stat.vice_captain_count / totalTeamsCount) * 100).toFixed(2),
        };
        return acc;
      }, {});

      // Structure response
      const teamMap = {};
      teams.forEach((row) => {
        const teamId = row.fantasy_team_id;
        if (!teamMap[teamId]) {
          teamMap[teamId] = {
            ...match,
            fantasy_team_id: teamId,
            fantasy_team_name: row.fantasy_team_name,
            total_points: row.total_points,
            team_status: row.team_status,
            players: [],
            backup_players: [],
            team1_player_count: 0,
            team2_player_count: 0,
            __seen: new Set(),
          };
        }

        // Skip duplicates per fantasy team (normalize to composite numeric key)
        const dedupKey = `${Number(row.player_id)}:${Number(
          row.player_team_id
        )}`;
        if (teamMap[teamId].__seen.has(dedupKey)) {
          return;
        }
        teamMap[teamId].__seen.add(dedupKey);

        const playerData = {
          id: row.player_id,
          name: row.player_name,
          role: row.player_role,
          is_captain: row.is_captain,
          is_vice_captain: row.is_vice_captain,
          substitute: row.substitute,
          teamId: row.player_team_id,
          team_short_name: row.player_team_short_name,
          imagePath: row.image_path,
          team: row.player_team_name,
          credits: row.player_credits, // 👈 added here
          player_id: row.player_id,
          captain_percentage: capStatsMap[row.player_id]?.cap || "0.00",
          vice_captain_percentage: capStatsMap[row.player_id]?.vc || "0.00",
        };

        if (row.substitute) {
          teamMap[teamId].backup_players.push(playerData);
        } else {
          teamMap[teamId].players.push(playerData);
          if (row.player_team_id === match.team1_id)
            teamMap[teamId].team1_player_count++;
          if (row.player_team_id === match.team2_id)
            teamMap[teamId].team2_player_count++;
        }
      });

      // Clean helper keys
      Object.values(teamMap).forEach((t) => {
        if (t.__seen) delete t.__seen;
      });

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyTeamsFetchedSuccessfully,
        Object.values(teamMap)
      );
    } catch (error) {
      console.error("Get teams error:", error);
      return apiResponse.ErrorResponse(
        res,
        FANTASYTTEAM.failedtogetfantasyteam
      );
    }
  },

  async getFantasyTeam(req, res) {
    try {
      const fantasyTeamId = req.params.id;

      const match = await db("fantasy_teams as ft")
        .select("ft.match_id", "m.team1_id", "m.team2_id")
        .join("matches as m", "ft.match_id", "m.id")
        .where("ft.id", fantasyTeamId)
        .andWhere("ft.user_id", req.user.id)
        .first();

      if (!match) {
        return res.status(404).json({
          status: false,
          message: "Fantasy team not found for this id.",
        });
      }

      const teamData = await db("fantasy_teams as ft")
        .select(
          "ft.id as fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points",
          "ft.status as team_status",
          "ftp.player_id",
          "ftp.is_captain",
          "ftp.is_vice_captain",
          "ftp.substitute",
          "p.name as player_name",
          "p.role as player_role",
          "pt.team_id as player_team_id",
          "t.name as player_team_name"
        )
        .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
        .join("players as p", "ftp.player_id", "p.id")
        .leftJoin("player_teams as pt", "p.id", "pt.player_id")
        .leftJoin("teams as t", "pt.team_id", "t.id")
        .where("ft.id", fantasyTeamId)
        .andWhere("ft.user_id", req.user.id)
        .whereIn("pt.team_id", [match.team1_id, match.team2_id])
        .orderBy("ftp.id", "asc");

      const teamDataBackupplayers = await db("fantasy_teams as ft")
        .select(
          "ft.id as fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points",
          "ft.status as team_status",
          "ftp.player_id",
          "ftp.is_captain",
          "ftp.is_vice_captain",
          "ftp.substitute",
          "p.name as player_name",
          "p.role as player_role",
          "pt.team_id as player_team_id",
          "t.name as player_team_name"
        )
        .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
        .join("players as p", "ftp.player_id", "p.id")
        .leftJoin("player_teams as pt", "p.id", "pt.player_id")
        .leftJoin("teams as t", "pt.team_id", "t.id")
        .where("ft.id", fantasyTeamId)
        .andWhere("ft.user_id", req.user.id)
        .andWhere("substitute", false)
        .whereIn("pt.team_id", [match.team1_id, match.team2_id])
        .orderBy("ftp.id", "asc");

      if (!teamData.length) {
        return res.status(404).json({
          status: false,
          message: "Fantasy team not found or no players.",
        });
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        teamData,
        teamDataBackupplayers
      );
    } catch (error) {
      console.error("Error joining contest:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // async getFantasyTeamupdated(req, res) {
  //   try {
  //     const fantasyTeamId = req.params.id;

  //     const allPlayers = await db("fantasy_teams as ft")
  //       .select(
  //         "ft.id as fantasy_team_id",
  //         "ft.name as fantasy_team_name",
  //         "ft.total_points",
  //         "ft.status as team_status",
  //         "ftp.player_id",
  //         "ftp.is_captain",
  //         "ftp.is_vice_captain",
  //         "ftp.substitute",
  //         "p.name as player_name",
  //         "p.role as player_role",
  //         "t.name as team_name"
  //       )
  //       .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
  //       .join("players as p", "ftp.player_id", "p.id")
  //       .join("teams as t", "p.team_id", "t.id")
  //       .where("ft.id", fantasyTeamId)
  //       .andWhere("ft.user_id", req.user.id)
  //       .orderBy("ftp.id", "asc");

  //     if (!allPlayers.length) {
  //       return res.status(404).json({
  //         status: false,
  //         message: "Fantasy team not found or no players.",
  //       });
  //     }

  //     const mainPlayers = allPlayers.filter((p) => p.substitute === false);
  //     const backupPlayers = allPlayers.filter((p) => p.substitute === true);

  //     return apiResponse.successResponseWithData(
  //       res,
  //       SUCCESS.dataFound,
  //       {
  //         allPlayers,
  //         mainPlayers,
  //         backupPlayers
  //       }
  //     );
  //   } catch (error) {
  //     console.error("Error fetching fantasy team:", error);
  //     return apiResponse.ErrorResponse(
  //       res,
  //       "Something went wrong while fetching the fantasy team"
  //     );
  //   }
  // },

  async joinContest(req, res) {
    try {
      const { contest_id, fantasy_team_id, team_name_user } = req.body;

      if (!contest_id || !fantasy_team_id) {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.requiredFieldsMissing
        );
      }
      const userId = req.user.id;

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

      // Check if match status is NS (Not Started) - only allow joining NS matches
      const match = await db("matches").where("id", contest.match_id).first();

      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found");
      }

      if (match.status !== "NS") {
        return apiResponse.ErrorResponse(
          res,
          "You can only join contests for matches that have not started yet (NS status)"
        );
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

      const wallet = await db("wallet").where({ user_id: userId }).first();

      if (
        !wallet ||
        parseFloat(wallet.balance) < parseFloat(contest.entry_fee)
      ) {
        return apiResponse.ErrorResponse(
          res,
          CONTEST.insufficientWalletBalance
        );
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
      const team1 = await db("teams").where("id", match.team1_id).first();
      const team2 = await db("teams").where("id", match.team2_id).first();

      const matchTitle =
        team1 && team2
          ? `${team1.short_name} vs ${team2.short_name}`
          : "Unknown Match";

      await db.transaction(async (trx) => {
        await trx("wallet")
          .where({ user_id: userId })
          .decrement("balance", contest.entry_fee);

        await trx("users")
          .where({ id: userId })
          .decrement("wallet_balance", contest.entry_fee);
        await trx("transactions").insert({
          user_id: userId,
          title: matchTitle,
          amount: parseFloat(contest.entry_fee),
          transactionType: "contest_spend",
          status: "SUCCESS",
          currency: "BDT",
          contest_id: contest_id,
          created_at: trx.fn.now(),
        });

        const [fantasyGameObj] = await trx("fantasy_games")
          .insert({
            user_id: req.user.id,
            contest_id,
            fantasy_team_id,
            team_name_user,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning("id"); // [{id: 54}]

        const fantasyGameId =
          typeof fantasyGameObj === "object" && fantasyGameObj !== null
            ? fantasyGameObj.id
            : fantasyGameObj;

        await trx("contests")
          .where("id", contest_id)
          .increment("filled_spots", 1);

        // Determine rank for the user in leaderboard
        const [{ count }] = await trx("leaderboard")
          .where("contestId", contest_id)
          .count("id as count");

        const userRank = Number(count) + 1;

        // Insert into leaderboard
        await trx("leaderboard").insert({
          contestId: contest_id,
          userId: userId,
          fantasyGameId: fantasyGameId,
          tournamentId: contest?.tournamentId,
          matchId: contest?.match_id,
          totalScore: 0,
          rank: userRank,
          is_finalized: false,
          created_at: trx.fn.now(),
          modified_at: trx.fn.now(),
        });
      });

      return apiResponse.successResponseWithData(res, CONTEST.joinnedContest);
    } catch (error) {
      console.error("Error joining contest:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getContestLeaderboard(req, res) {
    try {
      const contest_id = parseInt(req.params.contest_id);
      const viewerUserId = req.user.id;

      if (isNaN(contest_id)) {
        return res.status(400).json({ error: "Invalid contest_id parameter" });
      }

      // Get contest and verify it's finalized
      const contest = await db("contests").where("id", contest_id).first();

      if (!contest) {
        return apiResponse.ErrorResponse(res, CONTEST.contestNotFound);
      }

      // Get leaderboard entries with user and team data
      const leaderboard = await db("leaderboard as lb")
        .select(
          "lb.id",
          "lb.totalScore as total_points",
          "lb.rank",
          "u.id as user_id",
          "u.name as user_name",
          "u.image_url",
          "ft.id as fantasy_team_id",
          "ft.name as team_name",
          "fg.team_name_user"
        )
        .join("users as u", "lb.userId", "u.id")
        .join("fantasy_games as fg", "lb.fantasyGameId", "fg.id")
        .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .where("lb.contestId", contest_id)
        .orderBy("lb.rank", "asc");

      if (!leaderboard.length) {
        return res
          .status(404)
          .json({ message: "No leaderboard data found for this contest" });
      }

      const userIds = leaderboard.map((entry) => entry.user_id);

      // Build lineup map for the contest match to indicate if player was in Playing XI or as substitute
      const matchIdForContest = contest.match_id;
      const lineupRows = await db("match_players")
        .where({ match_id: matchIdForContest })
        .select("player_id", "is_playing_xi", "is_substitute");
      const lineupMap = new Map(
        lineupRows.map((r) => [
          Number(r.player_id),
          { inXI: !!r.is_playing_xi, isSub: !!r.is_substitute },
        ])
      );

      // Fetch players for all fantasy teams in the leaderboard in one query
      const fantasyTeamIds = leaderboard.map((entry) => entry.fantasy_team_id);
      let playersByTeamId = {};
      if (fantasyTeamIds.length > 0) {
        // Total fantasy teams for this match (denominator for percentages)
        const [{ count: totalTeamsCountRaw } = { count: 0 }] = await db(
          "fantasy_teams"
        )
          .where({ match_id: matchIdForContest })
          .countDistinct("id as count");
        const totalTeamsCount = Number(totalTeamsCountRaw) || 0;

        // Captain/Vice-captain counts per player for this match
        const capStatsRows = await db("fantasy_team_players as ftp")
          .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
          .where("ft.match_id", matchIdForContest)
          .groupBy("ftp.player_id")
          .select(
            "ftp.player_id",
            db.raw(
              "SUM(CASE WHEN ftp.is_captain THEN 1 ELSE 0 END) as captain_count"
            ),
            db.raw(
              "SUM(CASE WHEN ftp.is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
            )
          );
        const capStatsMap = capStatsRows.reduce((acc, row) => {
          acc[row.player_id] = {
            captain_count: Number(row.captain_count) || 0,
            vice_captain_count: Number(row.vice_captain_count) || 0,
          };
          return acc;
        }, {});

        const teamPlayersRows = await db("fantasy_team_players as ftp")
          .join("fantasy_teams as ft2", "ftp.fantasy_team_id", "ft2.id")
          .join("matches as mm", "ft2.match_id", "mm.id")
          .leftJoin("match_players as mp", function () {
            this.on("mp.match_id", "mm.id").andOn(
              "mp.player_id",
              "ftp.player_id"
            );
          })
          .join("players as p", "ftp.player_id", "p.id")
          .leftJoin("player_teams as pt", function () {
            this.on("p.id", "pt.player_id").andOn(function () {
              this.on("pt.team_id", "=", "mm.team1_id").orOn(
                "pt.team_id",
                "=",
                "mm.team2_id"
              );
            });
          })
          .leftJoin("teams as t", "pt.team_id", "t.id")
          .select(
            "ftp.fantasy_team_id",
            "ftp.player_id",
            "ftp.is_captain",
            "ftp.is_vice_captain",
            "ftp.substitute",
            db.raw("COALESCE(mp.is_playing_xi, false) as is_playing_xi"),
            db.raw("COALESCE(mp.is_substitute, false) as is_substitute"),
            db.raw(
              "COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup"
            ),
            "p.name as player_name",
            "p.role as player_role",
            "t.id as player_team_id",
            "t.name as player_team_name",
            "t.short_name as player_team_short_name",
            db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
          )
          .whereIn("ftp.fantasy_team_id", fantasyTeamIds);

        const seen = new Set();
        playersByTeamId = teamPlayersRows.reduce((acc, row) => {
          const key = `${row.fantasy_team_id}:${row.player_id}`;
          if (seen.has(key)) return acc;
          seen.add(key);
          const capCounts = capStatsMap[row.player_id] || {
            captain_count: 0,
            vice_captain_count: 0,
          };
          const captain_percentage =
            totalTeamsCount > 0
              ? ((capCounts.captain_count / totalTeamsCount) * 100).toFixed(2)
              : "0.00";
          const vice_captain_percentage =
            totalTeamsCount > 0
              ? (
                  (capCounts.vice_captain_count / totalTeamsCount) *
                  100
                ).toFixed(2)
              : "0.00";
          if (!acc[row.fantasy_team_id]) acc[row.fantasy_team_id] = [];
          acc[row.fantasy_team_id].push({
            id: row.player_id,
            player_id: row.player_id,
            name: row.player_name,
            role: row.player_role,
            is_captain: row.is_captain,
            is_vice_captain: row.is_vice_captain,
            substitute: row.substitute,
            in_lineup: row.in_lineup,
            is_playing_xi: row.is_playing_xi,
            is_substitute: row.is_substitute,
            teamId: row.player_team_id,
            team_short_name: row.player_team_short_name,
            team: row.player_team_name,
            imagePath: row.image_path ? row.image_path : "",
            captain_percentage,
            vice_captain_percentage,
          });
          return acc;
        }, {});
      }

      const [followersCounts, followingCounts, followingStatus] =
        await Promise.all([
          db("follow_unfollow")
            .whereIn("following_id", userIds)
            .select("following_id")
            .count("* as count")
            .groupBy("following_id"),
          db("follow_unfollow")
            .whereIn("follower_id", userIds)
            .select("follower_id")
            .count("* as count")
            .groupBy("follower_id"),
          db("follow_unfollow")
            .where("follower_id", viewerUserId)
            .whereIn("following_id", userIds)
            .select("following_id"),
        ]);

      const followersMap = new Map(
        followersCounts.map((f) => [f.following_id, parseInt(f.count)])
      );
      const followingMap = new Map(
        followingCounts.map((f) => [f.follower_id, parseInt(f.count)])
      );
      const followingSet = new Set(followingStatus.map((f) => f.following_id));

      const careerStats = await db("users as u")
        .leftJoin("fantasy_teams as ft", "u.id", "ft.user_id")
        .leftJoin("fantasy_games as fg", "u.id", "fg.user_id")
        .leftJoin("contests as c", "fg.contest_id", "c.id")
        .whereIn("u.id", userIds)
        .groupBy("u.id")
        .select(
          "u.id as user_id",
          db.raw("COUNT(DISTINCT fg.contest_id) as contests_played"),
          db.raw("COUNT(DISTINCT ft.match_id) as matches_played"),
          db.raw("COUNT(DISTINCT c.tournament_id) as series_played"),
          db.raw(`
            SUM(
              CASE 
                WHEN fg.rank = 1 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'1')::numeric 
                WHEN fg.rank = 2 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'2')::numeric
                WHEN fg.rank = 3 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'3')::numeric
                ELSE 0 
              END
            ) as total_winnings
          `),
          db.raw(
            "COUNT(DISTINCT CASE WHEN fg.rank = 1 THEN fg.id END) as contests_won"
          ),
          db.raw("MIN(fg.rank) as best_rank"),
          db.raw("SUM(ft.total_points) as total_points")
        );

      const careerStatsMap = new Map();
      careerStats.forEach((stat) => {
        const contestsPlayed = parseInt(stat.contests_played) || 0;
        careerStatsMap.set(stat.user_id, {
          contests: {
            total: contestsPlayed,
            won: parseInt(stat.contests_won) || 0,
            winPercentage:
              contestsPlayed > 0
                ? Math.round(
                    (parseInt(stat.contests_won) / contestsPlayed) * 100
                  )
                : 0,
            totalWinnings: parseFloat(stat.total_winnings) || 0,
          },
          matches: {
            total: parseInt(stat.matches_played) || 0,
            totalPoints: parseFloat(stat.total_points) || 0,
            bestRank: stat.best_rank ? parseInt(stat.best_rank) : null,
          },
          series: {
            total: parseInt(stat.series_played) || 0,
          },
        });
      });

      const formattedLeaderboard = leaderboard.map((entry) => ({
        id: entry.user_id,
        team_create_by_user: entry.team_name_user,
        team_name: entry.team_name,
        user_name: entry.user_name,
        imagePath: entry.image_url
          ? `${config.baseURL}/${entry.image_url}`
          : "",
        total_points: entry.total_points,
        rank: entry.rank,
        followers_count: followersMap.get(entry.user_id) || 0,
        following_count: followingMap.get(entry.user_id) || 0,
        isFollowing: followingSet.has(entry.user_id),
        fantasy_team: {
          id: entry.fantasy_team_id,
          name: entry.team_name,
          players: playersByTeamId[entry.fantasy_team_id] || [],
        },
        careerStats: careerStatsMap.get(entry.user_id) || {
          contests: { total: 0, won: 0, winPercentage: 0, totalWinnings: 0 },
          matches: { total: 0, totalPoints: 0, bestRank: null },
          series: { total: 0 },
        },
      }));

      return apiResponse.successResponseWithData(
        res,
        CONTEST.contestLeaderBoardFetchedSuccessfully,
        {
          data: formattedLeaderboard,
          is_finalized: contest.status === "completed",
        }
      );
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getContestDetails(req, res) {
    try {
      const { contest_id } = req.params;

      const contest = await db("contests as c")
        .select(
          "c.*",
          "m.start_time",
          "t1.name as team1_name",
          "t2.name as team2_name"
        )
        .leftJoin("matches as m", "c.match_id", "m.id")
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .where("c.id", contest_id)
        .first();

      if (!contest) {
        return apiResponse.ErrorResponse(res, CONTEST.contestNotFound);
      }

      // Parse winnings and calculate firstPrize + winPercentage
      let winnings = [];
      try {
        winnings =
          typeof contest.winnings === "string"
            ? JSON.parse(contest.winnings)
            : contest.winnings;
      } catch (err) {
        console.warn("Invalid winnings JSON for contest ID:", contest_id);
      }

      // Extract firstPrize
      const firstPrize =
        winnings.find((w) => w.from === 1 && w.to === 1)?.price || 0;

      // Calculate winPercentage
      let totalWinners = 0;
      for (const prize of winnings) {
        totalWinners += prize.to - prize.from + 1;
      }

      const winPercentage =
        contest.total_spots > 0
          ? Math.round((totalWinners / contest.total_spots) * 100)
          : 0;

      const finalContest = {
        ...contest,
        firstPrize,
        winPercentage,
      };

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        contest: finalContest,
      });
    } catch (error) {
      console.error("Contest error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateFantasyTeam(req, res) {
    const trx = await db.transaction();
    try {
      const { fantasy_team_id, inPlayers } = req.body;

      if (!fantasy_team_id || !Array.isArray(inPlayers)) {
        await trx.rollback();
        return apiResponse.validationErrorWithData(
          res,
          FANTASYTTEAM.invalidInput,
          null
        );
      }

      const teamWithMatch = await trx("fantasy_teams as ft")
        .join("fantasy_games as fg", "ft.id", "fg.fantasy_team_id")
        .join("contests as c", "fg.contest_id", "c.id")
        .join("matches as m", "c.match_id", "m.id")
        .select("m.status")
        .where("ft.id", fantasy_team_id)
        .andWhere("ft.user_id", req.user.id)
        .first();

      if (!teamWithMatch) {
        await trx.rollback();
        return apiResponse.ErrorResponse(res, "Team or Match not found");
      }

      if (teamWithMatch.status !== "NS") {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          "Team can’t be updated after match start"
        );
      }

      const mainPlayers = inPlayers.filter((p) => !p.substitute);

      if (mainPlayers.length !== 11) {
        await trx.rollback();
        return apiResponse.validationErrorWithData(
          res,
          FANTASYTTEAM.invalidInput11,
          null
        );
      }

      const mainPlayerIds = mainPlayers.map((p) => p.player_id);
      const uniquePlayerIds = new Set(mainPlayerIds);
      if (uniquePlayerIds.size !== 11) {
        await trx.rollback();
        return apiResponse.validationErrorWithData(
          res,
          FANTASYTTEAM.duplicatePlayerIds,
          null
        );
      }

      const captainCount = mainPlayers.filter((p) => p.is_captain).length;
      const viceCaptainCount = mainPlayers.filter(
        (p) => p.is_vice_captain
      ).length;

      if (captainCount !== 1 || viceCaptainCount !== 1) {
        await trx.rollback();
        return apiResponse.validationErrorWithData(
          res,
          FANTASYTTEAM.captainAndViceCaptainRequired,
          null
        );
      }

      const team = await trx("fantasy_teams")
        .where({ id: fantasy_team_id, user_id: req.user.id })
        .first();

      if (!team) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.failedtogetfantasyteam
        );
      }

      await trx("fantasy_team_players")
        .where({ fantasy_team_id })
        .andWhere("substitute", false)
        .del();

      const insertData = inPlayers.map((player) => ({
        fantasy_team_id,
        player_id: player.player_id,
        role: player.role || "player",
        is_captain: !!player.is_captain,
        is_vice_captain: !!player.is_vice_captain,
        substitute: !!player.substitute,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      }));

      await trx("fantasy_team_players").insert(insertData);

      await trx.commit();

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyTeamUpdated,
        {
          updated: mainPlayerIds,
        }
      );
    } catch (error) {
      await trx.rollback();
      console.error("updateFantasyTeam error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async myMatches(req, res) {
    try {
      const userId = req.user.id;
      const { type } = req.params;

      let query = db("fantasy_games as fg")
        .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .join("matches as m", "ft.match_id", "m.id")
        .join("teams as t1", "m.team1_id", "t1.id")
        .join("teams as t2", "m.team2_id", "t2.id")
        .leftJoin("venues as v", "m.venue", "v.venue_id")
        .leftJoin("countries as c", "v.country_id", "c.country_id")
        .join("tournaments as tour", "m.tournament_id", "tour.id")
        .where("fg.user_id", userId)
        .select(
          "m.*",
          "v.city as city",
          "c.name as country",
          "t1.name as team1_name",
          "t1.short_name as team1_short_name",
          "t1.logo_url as team1_logo_url",
          "t2.name as team2_name",
          "t2.short_name as team2_short_name",
          "t2.logo_url as team2_logo_url",
          "tour.name as tournament_name"
        )
        .groupBy(
          "m.id",
          "t1.name",
          "t1.short_name",
          "t2.name",
          "t2.short_name",
          "v.city",
          "c.name",
          "tour.name",
          "t1.logo_url",
          "t2.logo_url"
        );

      const getStatusFilter = (type) => {
        switch (type.toLowerCase()) {
          case "started":
          case "live":
            return [
              "1st Innings",
              "2nd Innings",
              "3rd Innings",
              "4th Innings",
              "Stump Day 1",
              "Stump Day 2",
              "Stump Day 3",
              "Stump Day 4",
              "Innings Break",
              "Tea Break",
              "Delayed",
              "Lunch",
              "Tea Break",
              "Dinner",
              "Live",
              "Int.",
            ];
          case "finished":
          case "completed":
            return ["Finished", "Completed", "Cancl", "Cancl.", "Cancelled"];
          case "ns":
          case "notstarted":
            return [
              "NS",
              "Not Started",
              "Not started",
              "Delayed",
              "Postp.",
              "Postponed",
            ];
          case "all":
            return null;
          default:
            return [type];
        }
      };

      if (type && type !== "all") {
        const statusFilter = getStatusFilter(type);
        if (statusFilter) {
          query =
            statusFilter.length === 1
              ? query.andWhere("m.status", statusFilter[0])
              : query.whereIn("m.status", statusFilter);
        }
      }

      const matches = await query.orderBy("m.start_time", "desc");
      const matchIds = matches.map((m) => m.id);

      if (matchIds.length === 0) {
        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, []);
      }
      // 2 Get seasonId mapping for each match
      const tournaments = await db("tournaments")
        .select("id", "metadata")
        .whereIn(
          "id",
          matches.map((m) => m.tournament_id)
        );

      const seasonIdsByMatch = new Map();
      for (const match of matches) {
        const tournament = tournaments.find(
          (t) => t.id === match.tournament_id
        );
        let seasonId = null;

        if (tournament?.metadata) {
          const metadata =
            typeof tournament.metadata === "string"
              ? JSON.parse(tournament.metadata)
              : tournament.metadata;
          seasonId = metadata.season_id;
        }
        seasonIdsByMatch.set(match.id, seasonId);
      }

      // Get notifications
      const notifications = await db("notifications")
        .whereIn("match_id", matchIds)
        .andWhere({ user_id: userId, status: true });
      const notificationsMap = new Map(
        notifications.map((n) => [n.match_id, true])
      );

      // Contest count per match
      const contestCounts = await db("contests")
        .select("match_id")
        .count("id as contest_count")
        .whereIn("match_id", matchIds)
        .groupBy("match_id");
      const contestCountMap = new Map(
        contestCounts.map((c) => [c.match_id, parseInt(c.contest_count)])
      );

      // User's teams count per match
      const userTeamsCounts = await db("fantasy_games as fg")
        .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .select("ft.match_id")
        .count("fg.id as teams_count")
        .where("fg.user_id", userId)
        .whereIn("ft.match_id", matchIds)
        .groupBy("ft.match_id");
      const userTeamsCountMap = new Map(
        userTeamsCounts.map((t) => [t.match_id, parseInt(t.teams_count)])
      );

      // Get ONLY user's contest entries (without stored rank)
      const contestEntries = await db("fantasy_games as fg")
        .join("contests as c", "fg.contest_id", "c.id")
        .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
        .leftJoin("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .join("users as u", "fg.user_id", "u.id")
        .select(
          "c.match_id",
          "c.id as contest_id",
          "c.filled_spots",
          "fg.team_name_user",
          "fg.fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points as fantasy_team_points",
          "ft.status as team_status",
          db.raw('COALESCE(lb."totalScore", NULL) as total_points'),
          "u.name as username",
          "u.image_url as profile_image"
        )
        .where("fg.user_id", userId)
        .whereIn("c.match_id", matchIds);

      // Get ALL contest entries for leaderboard calculation (all users)
      const allContestEntries = await db("fantasy_games as fg")
        .join("contests as c", "fg.contest_id", "c.id")
        .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
        .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .join("users as u", "fg.user_id", "u.id")
        .select(
          "c.match_id",
          "c.id as contest_id",
          "fg.fantasy_team_id",
          "ft.name as fantasy_team_name",
          "fg.team_name_user as team_label",
          "lb.totalScore as totalScore", // Use the official leaderboard score
          "lb.rank as leaderboard_rank", // Use the official leaderboard rank
          "u.name as username",
          "u.image_url as profile_image"
        )
        .whereIn("c.match_id", matchIds);

      // Group user's contest entries by match
      const contestsByMatchId = new Map();
      const usedTeamsByMatchId = new Map();

      for (const row of contestEntries) {
        if (!contestsByMatchId.has(row.match_id)) {
          contestsByMatchId.set(row.match_id, []);
        }
        contestsByMatchId.get(row.match_id).push({
          contest_id: row.contest_id,
          team_label: row.team_name_user,
          fantasy_team_id: row.fantasy_team_id,
          fantasy_team_name: row.fantasy_team_name,
          points: row.total_points !== null ? Number(row.total_points) : null,
          filled_spots: row.filled_spots ? Number(row.filled_spots) : 0,
          username: row.username,
          profile_image: row.profile_image
            ? `${config.baseURL}/${row.profile_image}`
            : null,
        });

        // Track only teams used in contests
        if (!usedTeamsByMatchId.has(row.match_id)) {
          usedTeamsByMatchId.set(row.match_id, new Map());
        }
        const teamKey = row.fantasy_team_id;
        if (!usedTeamsByMatchId.get(row.match_id).has(teamKey)) {
          usedTeamsByMatchId.get(row.match_id).set(teamKey, {
            id: row.fantasy_team_id,
            name: row.fantasy_team_name,
            label: row.team_name_user,
            total_points: row.fantasy_team_points ?? 0,
            team_status: row.team_status ?? 0,
          });
        }
      }

      // Build players for only used teams
      const allUsedTeamIds = Array.from(usedTeamsByMatchId.values())
        .flat()
        .map((t) => Array.from(t.values()))
        .flat()
        .map((t) => t.id);

      // Include ALL contest participants' fantasy teams (not just current user's)
      const allContestTeamIds = Array.from(
        new Set((allContestEntries || []).map((e) => e.fantasy_team_id))
      );
      const combinedTeamIds = Array.from(
        new Set([...allUsedTeamIds, ...allContestTeamIds])
      );

      let playersByTeamId = {};
      if (combinedTeamIds.length > 0) {
        const cases = Array.from(seasonIdsByMatch.entries())
          .map(
            ([matchId, seasonId]) =>
              `WHEN ft.match_id = ${matchId} THEN ${seasonId}`
          )
          .join(" ");

        const whenClauses = [];
        const whenParams = [];

        for (const [matchId, seasonId] of seasonIdsByMatch.entries()) {
          if (seasonId) {
            whenClauses.push("WHEN m.id = ? THEN ?");
            whenParams.push(matchId, seasonId);
          }
        }

        const caseExpr = whenClauses.length
          ? `pt.season_id = (CASE ${whenClauses.join(
              " "
            )} ELSE pt.season_id END)`
          : "1=1";

        const seenKeys = new Set();

        const teamPlayersRows = await db("fantasy_team_players as ftp")
          .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
          .join("matches as m", "ft.match_id", "m.id")
          .leftJoin("match_players as mp", function () {
            this.on("mp.match_id", "m.id").andOn(
              "mp.player_id",
              "ftp.player_id"
            );
          })
          .join("players as p", "ftp.player_id", "p.id")
          .leftJoin("player_teams as pt", function () {
            this.on("pt.player_id", "p.id")
              .andOn(function () {
                this.on("pt.team_id", "=", "m.team1_id").orOn(
                  "pt.team_id",
                  "m.team2_id"
                );
              })
              .andOn(db.raw(caseExpr, whenParams));
          })
          .leftJoin("teams as t", "pt.team_id", "t.id")
          .select(
            "ftp.fantasy_team_id",
            "ftp.player_id",
            db.raw("BOOL_OR(ftp.is_captain) as is_captain"),
            db.raw("BOOL_OR(ftp.is_vice_captain) as is_vice_captain"),
            db.raw("BOOL_OR(ftp.substitute) as substitute"),
            "m.id as match_id",
            db.raw("COALESCE(mp.is_playing_xi, false) as is_playing_xi"),
            db.raw("COALESCE(mp.is_substitute, false) as is_substitute"),
            db.raw(
              "COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup"
            ),
            "ftp.points",
            "p.name as player_name",
            "p.role as player_role",
            "p.credits as player_credits",
            "t.id as player_team_id",
            "t.name as player_team_name",
            "t.short_name as player_team_short_name",
            db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
          )
          .whereIn("ftp.fantasy_team_id", combinedTeamIds)
          .groupBy(
            "ftp.fantasy_team_id",
            "ftp.player_id",
            "ftp.points",
            "t.id",
            "mp.id",
            "p.id",
            "m.id"
          );

        playersByTeamId = teamPlayersRows.reduce((acc, row) => {
          const dedupKey = `${row.fantasy_team_id}:${row.player_id}`;
          if (seenKeys.has(dedupKey)) return acc;
          seenKeys.add(dedupKey);
          if (!acc[row.fantasy_team_id]) acc[row.fantasy_team_id] = [];
          acc[row.fantasy_team_id].push({
            id: row.player_id,
            player_id: row.player_id,
            name: row.player_name,
            role: row.player_role,
            credits: row.player_credits,
            is_captain: row.is_captain,
            is_vice_captain: row.is_vice_captain,
            substitute: row.substitute,
            teamId: row.player_team_id,
            team_short_name: row.player_team_short_name,
            team: row.player_team_name,
            imagePath: row.image_path,
            fantasy_point: Number(row.points) || 0,
            captain_percentage: "0.00",
            vice_captain_percentage: "0.00",
            in_lineup: row.in_lineup,
            is_playing_xi: row.is_playing_xi,
            is_substitute: row.is_substitute,
          });
          return acc;
        }, {});

        var teamTotals = {};
        Object.entries(playersByTeamId).forEach(([teamId, players]) => {
          let total = 0;
          for (const p of players) {
            let mult = 1;
            if (p.is_captain) mult = 2;
            else if (p.is_vice_captain) mult = 1.5;
            total += (Number(p.fantasy_point) || 0) * mult;
          }
          teamTotals[teamId] = Number(total.toFixed(2));
        });
      }

      // Final response with fixed ranking logic
      // const matchesWithNotification = matches.map((match) => {
      //   const time_ago = moment(match.start_time).fromNow();
      //   const is_match_live = [
      //     "1st Innings",
      //     "2nd Innings",
      //     "3rd Innings",
      //     "Live",
      //   ].includes(match.status);
      //   let toss = null;
      //   let toss_team_name = null;
      //   let elected = null;
      //   const metadata =
      //     typeof match.metadata === "string"
      //       ? JSON.parse(match.metadata)
      //       : match.metadata;

      //   if (metadata && metadata.toss_won_team_id && metadata.elected) {
      //     // Map SportMonks team IDs to database team IDs
      //     const tossSportMonksId = metadata.toss_won_team_id;

      //     if (tossSportMonksId === metadata.localteam_id) {
      //       toss_team_name = match.team1_name;
      //     } else if (tossSportMonksId === metadata.visitorteam_id) {
      //       toss_team_name = match.team2_name;
      //     } else {
      //       // Fallback: Use team names based on common SportMonks ID mapping
      //       toss_team_name =
      //         tossSportMonksId === 98
      //           ? match.team1_name
      //           : tossSportMonksId === 99
      //           ? match.team2_name
      //           : "Unknown Team";
      //     }

      //     elected = metadata.elected;
      //     toss = `${toss_team_name} won the toss and elected to ${elected}`;
      //   }

      //   let result_note = null;
      //   let winner_team = null;
      //   if (["Finished", "Completed"].includes(match.status)) {
      //     const metadata =
      //       typeof match.metadata === "string"
      //         ? JSON.parse(match.metadata)
      //         : match.metadata;
      //     const scorecard =
      //       typeof match.scorecard === "string"
      //         ? JSON.parse(match.scorecard)
      //         : match.scorecard;
      //     const victoryTeamId =
      //       match.victory_team_id ||
      //       metadata?.winner_team_id ||
      //       scorecard?.winner_team_id;

      //     result_note = metadata?.note || scorecard?.note || null;

      //     if (victoryTeamId) {
      //       if (victoryTeamId == match.team1_id) {
      //         winner_team = {
      //           id: match.team1_id,
      //           name: match.team1_name,
      //           short_name: match.team1_short_name,
      //           logo_url: match.team1_logo_url,
      //         };
      //       } else if (victoryTeamId == match.team2_id) {
      //         winner_team = {
      //           id: match.team2_id,
      //           name: match.team2_name,
      //           short_name: match.team2_short_name,
      //           logo_url: match.team2_logo_url,
      //         };
      //       }
      //     }
      //   }

      //   const isFinished = ["Finished", "Completed"].includes(match.status);

      //   const isLiveOrStarted = [
      //     "1st Innings",
      //     "2nd Innings",
      //     "3rd Innings",
      //     "Live",
      //   ].includes(match.status);

      //   // For both finished and live/started, include contest and teams arrays
      //   const shouldIncludeContestTeams = isFinished || isLiveOrStarted;

      //   return {
      //     ...match,
      //     time_ago,
      //     is_match_live,
      //     total_contest: contestCountMap.get(match.id) || 0,
      //     total_teams: userTeamsCountMap.get(match.id) || 0,
      //     is_match_notification: !!notificationsMap.get(match.id),
      //     toss, // Add formatted toss information
      //     toss_team_name, // Add toss team name separately
      //     elected, //
      //     result_note,
      //     winner_team,
      //     contets: shouldIncludeContestTeams
      //       ? {
      //           total: (contestsByMatchId.get(match.id) || []).length,
      //           list: (contestsByMatchId.get(match.id) || []).map((contest) => {
      //             const allEntriesInContest = (allContestEntries || []).filter(
      //               (c) => c.contest_id === contest.contest_id
      //             );

      //             const leaderboard = allEntriesInContest
      //               .sort((a, b) => b.totalscore - a.totalscore)
      //               .map((c, index) => ({
      //                 fantasy_team_id: c.fantasy_team_id,
      //                 team_label: c.team_label,
      //                 fantasy_team_name: c.fantasy_team_name,
      //                 rank: index + 1,
      //                 points: c.totalscore,
      //                 username: c.username,
      //                 profile_image: c.profile_image
      //                   ? `${config.baseURL}/${c.profile_image}`
      //                   : null,
      //               }));

      //             // Find current user's team rank from the dynamically built leaderboard
      //             const myTeamRank =
      //               leaderboard.find(
      //                 (l) => l.fantasy_team_id === contest.fantasy_team_id
      //               )?.rank || null;

      //             return {
      //               contest_id: contest.contest_id,
      //               team_label: contest.team_label,
      //               fantasy_team_id: contest.fantasy_team_id,
      //               fantasy_team_name: contest.fantasy_team_name,
      //               points: contest.points,
      //               filled_spots: contest.filled_spots,
      //               username: contest.username,
      //               profile_image: contest.profile_image,
      //               rank: myTeamRank,
      //               leaderboard,
      //             };
      //           }),
      //           total_participants: (() => {
      //             // Calculate total participants across all contests for this match
      //             const contests = contestsByMatchId.get(match.id) || [];
      //             const uniqueContestIds = new Set();
      //             let totalParticipants = 0;
      //             for (const contest of contests) {
      //               if (
      //                 contest.contest_id &&
      //                 !uniqueContestIds.has(contest.contest_id)
      //               ) {
      //                 uniqueContestIds.add(contest.contest_id);
      //                 totalParticipants += contest.filled_spots || 0;
      //               }
      //             }
      //             return totalParticipants;
      //           })(),
      //         }
      //       : undefined,
      //     teams: shouldIncludeContestTeams
      //       ? Array.from(usedTeamsByMatchId.get(match.id) || []).map(
      //           ([_, team]) => ({
      //             backup_players: [],
      //             fantasy_team_id: team.id,
      //             fantasy_team_name: team.name,
      //             match_id: match.id,
      //             players: playersByTeamId[team.id] || [],
      //             team1_id: match.team1_id,
      //             team1_image: match.team1_logo_url,
      //             team1_player_count: (playersByTeamId[team.id] || []).filter(
      //               (p) => p.teamId === match.team1_id && !p.substitute
      //             ).length,
      //             team1_short_name: match.team1_short_name,
      //             team2_id: match.team2_id,
      //             team2_image: match.team2_logo_url,
      //             team2_player_count: (playersByTeamId[team.id] || []).filter(
      //               (p) => p.teamId === match.team2_id && !p.substitute
      //             ).length,
      //             team2_short_name: match.team2_short_name,
      //             team_status: team.team_status,
      //             total_points: team.total_points,
      //           })
      //         )
      //       : undefined,
      //   };
      // });
      const matchesWithNotification = matches.map((match) => {
        const time_ago = moment(match.start_time).fromNow();
        const is_match_live = [
          "1st Innings",
          "2nd Innings",
          "3rd Innings",
          "Live",
        ].includes(match.status);
        let toss = null;
        let toss_team_name = null;
        let elected = null;
        const metadata =
          typeof match.metadata === "string"
            ? JSON.parse(match.metadata)
            : match.metadata;

        if (metadata && metadata.toss_won_team_id && metadata.elected) {
          const tossSportMonksId = metadata.toss_won_team_id;

          if (tossSportMonksId === metadata.localteam_id) {
            toss_team_name = match.team1_name;
          } else if (tossSportMonksId === metadata.visitorteam_id) {
            toss_team_name = match.team2_name;
          } else {
            toss_team_name =
              tossSportMonksId === 98
                ? match.team1_name
                : tossSportMonksId === 99
                ? match.team2_name
                : "Unknown Team";
          }

          elected = metadata.elected;
          toss = `${toss_team_name} won the toss and elected to ${elected}`;
        }

        let result_note = null;
        let winner_team = null;
        if (["Finished", "Completed"].includes(match.status)) {
          const metadata =
            typeof match.metadata === "string"
              ? JSON.parse(match.metadata)
              : match.metadata;
          const scorecard =
            typeof match.scorecard === "string"
              ? JSON.parse(match.scorecard)
              : match.scorecard;
          const victoryTeamId =
            match.victory_team_id ||
            metadata?.winner_team_id ||
            scorecard?.winner_team_id;

          result_note = metadata?.note || scorecard?.note || null;

          if (victoryTeamId) {
            if (victoryTeamId == match.team1_id) {
              winner_team = {
                id: match.team1_id,
                name: match.team1_name,
                short_name: match.team1_short_name,
                logo_url: match.team1_logo_url,
              };
            } else if (victoryTeamId == match.team2_id) {
              winner_team = {
                id: match.team2_id,
                name: match.team2_name,
                short_name: match.team2_short_name,
                logo_url: match.team2_logo_url,
              };
            }
          }
        }

        const isFinished = ["Finished", "Completed"].includes(match.status);
        const isLiveOrStarted = [
          "1st Innings",
          "2nd Innings",
          "3rd Innings",
          "Live",
        ].includes(match.status);

        // For both finished and live/started, include contest and teams arrays
        const shouldIncludeContestTeams = isFinished || isLiveOrStarted;

        return {
          ...match,
          time_ago,
          is_match_live,
          total_contest: contestCountMap.get(match.id) || 0,
          total_teams: userTeamsCountMap.get(match.id) || 0,
          is_match_notification: !!notificationsMap.get(match.id),
          toss,
          toss_team_name,
          elected,
          result_note,
          winner_team,
          contets: shouldIncludeContestTeams
            ? {
                total: (contestsByMatchId.get(match.id) || []).length,
                list: (contestsByMatchId.get(match.id) || []).map((contest) => {
                  const allEntriesInContest = (allContestEntries || []).filter(
                    (c) => c.contest_id === contest.contest_id
                  );

                  // Use official leaderboard data instead of calculated points
                  const leaderboardWithOfficialData = allEntriesInContest
                    .map((c) => {
                      // Find the official leaderboard entry for this team
                      const officialEntry = allContestEntries.find(
                        (entry) =>
                          entry.fantasy_team_id === c.fantasy_team_id &&
                          entry.contest_id === contest.contest_id
                      );

                      return {
                        ...c,
                        calculatedPoints: officialEntry
                          ? Number(officialEntry.totalScore) || 0
                          : 0,
                        officialRank: officialEntry
                          ? Number(officialEntry.leaderboard_rank) || null
                          : null,
                      };
                    })
                    .sort((a, b) => {
                      // Sort by official rank if available, otherwise by calculated points
                      if (a.officialRank !== null && b.officialRank !== null) {
                        return a.officialRank - b.officialRank;
                      }
                      return b.calculatedPoints - a.calculatedPoints;
                    })
                    .map((c, index) => {
                      let playersArr = [];
                      let team1PlayerCount = 0;
                      let team2PlayerCount = 0;

                      if (
                        (isLiveOrStarted || isFinished) &&
                        playersByTeamId[c.fantasy_team_id]
                      ) {
                        playersArr = playersByTeamId[c.fantasy_team_id].map(
                          (player) => {
                            // Count players from each team
                            if (
                              player.teamId === match.team1_id &&
                              !player.substitute
                            ) {
                              team1PlayerCount++;
                            } else if (
                              player.teamId === match.team2_id &&
                              !player.substitute
                            ) {
                              team2PlayerCount++;
                            }

                            return {
                              ...player,
                            };
                          }
                        );
                      }

                      // Use official rank if available, otherwise use calculated rank
                      const rank =
                        c.officialRank !== null ? c.officialRank : index + 1;
                      const points = c.calculatedPoints;

                      return {
                        fantasy_team_id: c.fantasy_team_id,
                        team_label: c.team_label,
                        fantasy_team_name: c.fantasy_team_name,
                        rank: rank,
                        points: points,
                        username: c.username,
                        profile_image: c.profile_image
                          ? `${config.baseURL}/${c.profile_image}`
                          : null,
                        // Add the requested team information
                        team1_short_name: match.team1_short_name,
                        team2_short_name: match.team2_short_name,
                        team1_player_count: team1PlayerCount,
                        team2_player_count: team2PlayerCount,
                        ...(isLiveOrStarted || isFinished
                          ? { players: playersArr }
                          : {}),
                      };
                    });

                  // Find current user's team rank from the leaderboard
                  const myTeamRank =
                    leaderboardWithOfficialData.find(
                      (l) => l.fantasy_team_id === contest.fantasy_team_id
                    )?.rank || null;

                  return {
                    contest_id: contest.contest_id,
                    team_label: contest.team_label,
                    fantasy_team_id: contest.fantasy_team_id,
                    fantasy_team_name: contest.fantasy_team_name,
                    points:
                      leaderboardWithOfficialData.find(
                        (l) => l.fantasy_team_id === contest.fantasy_team_id
                      )?.points || 0, // Use official points
                    filled_spots: contest.filled_spots,
                    username: contest.username,
                    profile_image: contest.profile_image,
                    rank: myTeamRank,
                    leaderboard: leaderboardWithOfficialData,
                  };
                }),
                total_participants: (() => {
                  const contests = contestsByMatchId.get(match.id) || [];
                  const uniqueContestIds = new Set();
                  let totalParticipants = 0;
                  for (const contest of contests) {
                    if (
                      contest.contest_id &&
                      !uniqueContestIds.has(contest.contest_id)
                    ) {
                      uniqueContestIds.add(contest.contest_id);
                      totalParticipants += contest.filled_spots || 0;
                    }
                  }
                  return totalParticipants;
                })(),
              }
            : undefined,
          teams: shouldIncludeContestTeams
            ? Array.from(usedTeamsByMatchId.get(match.id) || []).map(
                ([_, team]) => {
                  const players = playersByTeamId[team.id] || [];

                  // Find official points from leaderboard for this team
                  const officialPointsEntry = allContestEntries.find(
                    (entry) => entry.fantasy_team_id === team.id
                  );
                  const totalPoints = officialPointsEntry
                    ? Number(officialPointsEntry.totalScore) || 0
                    : teamTotals[team.id] || 0;

                  return {
                    backup_players: [],
                    fantasy_team_id: team.id,
                    fantasy_team_name: team.name,
                    match_id: match.id,
                    players: players,
                    team1_id: match.team1_id,
                    team1_image: match.team1_logo_url,
                    team1_player_count: players.filter(
                      (p) => p.teamId === match.team1_id && !p.substitute
                    ).length,
                    team1_short_name: match.team1_short_name,
                    team2_id: match.team2_id,
                    team2_image: match.team2_logo_url,
                    team2_player_count: players.filter(
                      (p) => p.teamId === match.team2_id && !p.substitute
                    ).length,
                    team2_short_name: match.team2_short_name,
                    team_status: team.team_status,
                    total_points: Number(totalPoints.toFixed(2)),
                  };
                }
              )
            : undefined,
        };
      });

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        matchesWithNotification
      );
    } catch (error) {
      console.error("myMatches error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async addBackupPlayers(req, res) {
    const trx = await db.transaction();
    try {
      const { fantasy_team_id, inPlayers } = req.body;

      if (!fantasy_team_id || !Array.isArray(inPlayers)) {
        await trx.rollback();
        return apiResponse.validationErrorWithData(
          res,
          "Missing or invalid data",
          null
        );
      }

      // Verify team exists and belongs to user
      const team = await trx("fantasy_teams")
        .where({ id: fantasy_team_id, user_id: req.user.id })
        .first();

      if (!team) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          "Fantasy team not found or unauthorized"
        );
      }

      // Get existing main players to prevent duplicates
      const existingMainPlayers = await trx("fantasy_team_players")
        .where("fantasy_team_id", fantasy_team_id)
        .where("substitute", false)
        .pluck("player_id");

      // Check if main team has 11 players
      if (existingMainPlayers.length !== 11) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          "Main team must have exactly 11 players before adding backup players"
        );
      }

      // Check if any of the new players are already in the main team
      const duplicatesWithMain = inPlayers.filter((p) =>
        existingMainPlayers.includes(p.player_id)
      );

      if (duplicatesWithMain.length > 0) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          `Players ${duplicatesWithMain
            .map((p) => p.player_id)
            .join(", ")} already exist in the main team`
        );
      }

      // Get current backup players
      const currentBackupPlayers = await trx("fantasy_team_players")
        .where("fantasy_team_id", fantasy_team_id)
        .where("substitute", true)
        .select("id", "player_id", "role");

      // Create a map of player IDs for quick lookup
      const newPlayerIdsSet = new Set(inPlayers.map((p) => p.player_id));
      const existingPlayerIdsSet = new Set(
        currentBackupPlayers.map((p) => p.player_id)
      );

      // Find players to add (new players that don't exist in current backups)
      const playersToAdd = inPlayers.filter(
        (p) => !existingPlayerIdsSet.has(p.player_id)
      );

      // Find players to keep (existing players that aren't being replaced)
      const playersToKeep = currentBackupPlayers.filter(
        (p) => !newPlayerIdsSet.has(p.player_id)
      );

      // Calculate how many players we can keep to stay under the limit of 4
      const maxPlayersToKeep = Math.max(0, 4 - inPlayers.length);
      const playersToKeepLimited = playersToKeep.slice(0, maxPlayersToKeep);

      // If we need to remove some existing players
      if (playersToKeep.length > maxPlayersToKeep) {
        const playerIdsToRemove = playersToKeep
          .slice(maxPlayersToKeep)
          .map((p) => p.id);
        if (playerIdsToRemove.length > 0) {
          await trx("fantasy_team_players")
            .whereIn("id", playerIdsToRemove)
            .del();
        }
      }

      // Insert new players
      if (playersToAdd.length > 0) {
        const insertData = playersToAdd.map((p) => ({
          fantasy_team_id,
          player_id: p.player_id,
          role: p.role,
          is_captain: false,
          is_vice_captain: false,
          substitute: true,
          points: 0,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        }));

        await trx("fantasy_team_players").insert(insertData);
      }

      await trx.commit();

      // Get updated backup players list
      const updatedBackupPlayers = await db("fantasy_team_players")
        .where("fantasy_team_id", fantasy_team_id)
        .where("substitute", true)
        .select("player_id", "role")
        .orderBy("id", "asc");

      return apiResponse.successResponseWithData(
        res,
        "Backup Players Updated Successfully",
        {
          fantasy_team_id,
          added_count: playersToAdd.length,
          kept_count: playersToKeepLimited.length,
          total_backup_count: updatedBackupPlayers.length,
          backup_players: updatedBackupPlayers,
        }
      );
    } catch (error) {
      await trx.rollback();
      console.error("addBackupPlayers error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async toggleMatchNotificationById(req, res) {
    try {
      const userId = req.user.id;
      const { match_id, status } = req.body;

      if (!match_id || typeof status !== "boolean") {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.matchIdAndStatusRequired
        );
      }

      const match = await db("matches").where({ id: match_id }).first();
      if (!match) return apiResponse.ErrorResponse(res, "Match not found");
      if (!match.start_time)
        return apiResponse.ErrorResponse(res, "Match start_time not set");

      const startTime = moment(match.start_time);
      const notifyTime = startTime.subtract(5, "minutes").toDate();
      const template = await db("notification_templates")
        .where({ slug: "Match-Reminder", status: 1 })
        .first();

      let notifTitle = "Match Reminder";
      let notifContent = `Your match ${
        match.match_number || match_id
      } starts at ${startTimeFormatted}`;

      if (template) {
        notifTitle = template.title || notifTitle;
        notifContent = template.content
          .replace("{{matchNumber}}", match.match_number || match_id)
          .replace("{{startTime}}", startTimeFormatted);
      }

      const notification = await db("notifications")
        .where({
          user_id: userId,
          title: notifTitle,
          content: notifContent,
        })
        .first();

      if (status) {
        if (!notification || notification.status === false) {
          if (notification) {
            await db("notifications")
              .where({ id: notification.id })
              .update({ status: true, sent_at: notifyTime });
          } else {
            await db("notifications").insert({
              user_id: userId,
              title: notifTitle,
              content: notifContent,
              sent_at: notifyTime,
              match_id,
              created_at: new Date(),
              status: true,
            });
          }
          return apiResponse.successResponse(
            res,
            FANTASYTTEAM.matchNotificationsEnabled
          );
        }
        return apiResponse.successResponse(
          res,
          FANTASYTTEAM.notificationAlreadyEnabled
        );
      } else {
        if (notification && notification.status === true) {
          await db("notifications")
            .where({ id: notification.id })
            .update({ status: false });
          return apiResponse.successResponse(
            res,
            FANTASYTTEAM.notificationAlreadyEnabled
          );
        }
        return apiResponse.successResponse(
          res,
          FANTASYTTEAM.notificationAlreadyDisabled
        );
      }
    } catch (error) {
      console.error("toggleMatchNotificationById error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async copyFantasyTeam(req, res) {
    const trx = await db.transaction();
    try {
      const userId = req.user.id;
      const { players, fantasy_team_id } = req.body;

      if (!Array.isArray(players) || players.length === 0) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.missingOrEmptyPlayersArray
        );
      }

      const existingTeam = await trx("fantasy_teams")
        .where({ id: fantasy_team_id })
        .first();

      if (!existingTeam) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.originalTeamNotFound
        );
      }

      const firstPlayer = players[0];
      const playerMatch = await trx("player_teams as pt")
        .join("matches as m", function () {
          this.on("m.team1_id", "=", "pt.team_id").orOn(
            "m.team2_id",
            "=",
            "pt.team_id"
          );
        })
        .where("pt.player_id", firstPlayer.player_id)
        .select("m.id as match_id")
        .first();

      if (!playerMatch) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.couldNotFindAssociatedMatchForPlayers
        );
      }

      const [newTeam] = await trx("fantasy_teams")
        .insert({
          user_id: userId,
          match_id: playerMatch.match_id,
          name: existingTeam.name,
          total_points: 0,
          status: 0,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      const formattedPlayers = players.map((p) => ({
        fantasy_team_id: newTeam.id,
        player_id: p.player_id,
        role: p.role || null,
        is_captain: Boolean(p.is_captain || false),
        is_vice_captain: Boolean(p.is_vice_captain || false),
        substitute: Boolean(p.substitute || false),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      }));

      const capCount = formattedPlayers.filter((p) => p.is_captain).length;
      const vcCount = formattedPlayers.filter((p) => p.is_vice_captain).length;

      if (capCount !== 1 || vcCount !== 1) {
        await trx.rollback();
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.captainAndViceCaptainRequired
        );
      }

      await trx("fantasy_team_players").insert(formattedPlayers);
      await trx.commit();

      const responseData = {
        team_id: newTeam.id,
        team_name: newTeam.name,
        match_id: playerMatch.match_id,
        players: formattedPlayers.map((p) => ({
          player_id: p.player_id,
          role: p.role,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          substitute: p.substitute,
        })),
      };

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.teamCopiedSuccessfully,
        responseData
      );
    } catch (error) {
      await trx.rollback();
      console.error("copyFantasyTeam error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = contestController;
