const { knex } = require("../../config/database");
const sportmonksService = require("../../services/sportmonksService");
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator, listing } = require("../../utils/functions");
const { ERROR, USER, SUCCESS, MATCH } = require("../../utils/responseMsg");
const moment = require("moment");
const tournamentDbService = require("../../services/tournamentDbService");
const { default: axios } = require("axios");

const matchController = {
  async getAllmatchesOfTournaments(req, res) {
    try {
      const { tournament_id } = req.params;
      const seasonRow = await knex("tournaments")
      .select("season")
      .where("id", tournament_id)
      .first();

    if (!seasonRow) {
      return apiResponse.ErrorResponse(res, "Tournament not found");
    }

    const seasonId = seasonRow.season;
      console.log(tournament_id)
      let query = knex("matches")
        .select(
          "matches.id",
          "matches.sm_match_id as match_id",
          "tournaments.id as tournament_id",
          "tournaments.name as tournament_name",
          "matches.match_number",
          "matches.match_type",
          "matches.start_time",
          "matches.status",
          "t1.id as team1_id",
          "t1.logo_url as team1_logo_url",
          "t2.id as team2_id",
          "t2.logo_url as team2_logo_url",
          "t1.name as team1_name",
          "t1.short_name as team1_shortName",
          "t2.name as team2_name",
          "t2.short_name as team2_shortName",
          knex.raw("COUNT(contests.id) as contest_count"),
          knex.raw("COALESCE(SUM(CAST(contests.prize_pool::text AS NUMERIC)), 0) as prize_pool")
    
        )
        .where("matches.tournament_id", Number(tournament_id))
        .where("matches.status", "NS")
        .whereNotNull("t1.name")
        .whereNotNull("t2.name")
        .whereNotNull("t1.id")
        .whereNotNull("t2.id")
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
        .leftJoin("contests", "matches.id", "contests.match_id")
         // ✅ Only include matches where BOTH teams have players mapped for this season
      .whereExists(function () {
        this.select("*")
          .from("player_teams")
          .whereRaw("player_teams.team_id = matches.team1_id")
          .andWhere("player_teams.season_id", seasonId);
      })
      .whereExists(function () {
        this.select("*")
          .from("player_teams")
          .whereRaw("player_teams.team_id = matches.team2_id")
          .andWhere("player_teams.season_id", seasonId);
      })
        
       
        .groupBy(
          "matches.id",
          "tournaments.id",
          "tournaments.name",
          "t1.id",
          "t1.logo_url",
          "t2.id",
          "t2.logo_url",
          "t1.name",
          "t1.short_name",
          "t2.name",
          "t2.short_name"
        )

        .orderBy("matches.start_time", "asc");

      if (tournament_id) {
        query = query.where("matches.tournament_id", tournament_id);
      }
      const matches = await query;

      const matchesWithTimeAgo = matches.map((match) => ({
        ...match,
        time_ago: moment(match.start_time).fromNow(),
      }));

      let matchesWithNotification = matchesWithTimeAgo;
      if (req.user && req.user.id) {
        const userId = req.user.id;
        const matchIds = matchesWithTimeAgo.map((m) => m.id);
        let notificationsMap = new Map();
        if (matchIds.length > 0) {
          const notifications = await knex("notifications")
            .whereIn("match_id", matchIds)
            .andWhere({ user_id: userId, status: true });
          notificationsMap = new Map(
            notifications.map((n) => [n.match_id, true])
          );
        }
        matchesWithNotification = matchesWithTimeAgo.map((match) => ({
          ...match,
          is_match_notification: !!notificationsMap.get(match.id),
        }));
      }

      const { getLanguage } = require("../../utils/responseMsg");
      const { translateTo } = require("../../utils/google");

      const lang =
        getLanguage().toLowerCase() === "hn"
          ? "hi"
          : getLanguage().toLowerCase();

      const translated = await Promise.all(
        matchesWithNotification.map(async (match) => {
          const translatedName = await translateTo(match.tournament_name, lang);
          return {
            ...match,
            tournament_name: translatedName,
          };
        })
      );

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        translated
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // async getAllmatchesOfTournament(req, res) {
  //   try {
  //     const { tournament_id, category } = req.params;
  //     const userid = req.user.id;
  //     const today = moment().startOf("day").toDate();
  //     const oneMonthLater = moment().add(1, "months").endOf("day").toDate();
  //     const next24Hours = moment().add(24, "hours").toDate();
  //     const now = moment().toDate();

  //     console.log("today", today, "oneMonthLater", oneMonthLater);

  //     const UPCOMING = [
  //       "NS",
  //       "Delayed",
  //       "Not Started",
  //       "1st Innings",
  //       "2nd Innings",
  //       "3rd Innings",
  //       "Live",
  //     ];
  //     const LIVE = ["1st Innings", "2nd Innings", "3rd Innings", "Live"];
  //     const EXCLUDE = ["Finished", "Completed"];
  //     let query = knex("matches")
  //       .select(
  //         "matches.id",
  //         "matches.sm_match_id as sm_match_id",
  //         "matches.id as match_id",
  //         "tournaments.id as tournament_id",

  //         "t1.id as team1_id",
  //         "t1.logo_url as team1_logo_url",
  //         "t2.id as team2_id",
  //         "t2.logo_url as team2_logo_url",
  //         "t1.name as team1_name",
  //         "t1.short_name as team1_shortName",
  //         "t2.name as team2_name",
  //         "t2.short_name as team2_shortName",
  //         "matches.match_number",
  //         "matches.match_type",
  //         "matches.start_time",
  //         "matches.status",
  //         "tournaments.name as tournament_name",

  //         knex.raw(
  //           "COALESCE(SUM(CAST(contests.prize_pool::text AS NUMERIC)), 0) as total_prize_pool"
  //         ),
  //         knex.raw("COUNT(contests.id) as contest_count")
  //       )
  //       .where("matches.tournament_id", tournament_id)
  //       .whereNotNull("t1.name")
  //       .whereNotNull("t2.name")
  //       .whereNotNull("t1.id")
  //       .whereNotNull("t2.id")
  //       .leftJoin("teams as t1", "matches.team1_id", "t1.id")
  //       .leftJoin("teams as t2", "matches.team2_id", "t2.id")
  //       .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
  //       .leftJoin("contests", "matches.id", "contests.match_id")
  //       whereBetween("matches.start_time", [today, oneMonthLater])
        

  //       .groupBy(
  //         "matches.id",
  //         "matches.match_number",
  //         "matches.match_type",
  //         "matches.start_time",
  //         "matches.status",
  //         "t1.id",
  //         "t2.id",
  //         "t1.name",
  //         "t1.short_name",
  //         "t2.name",
  //         "t2.short_name",
  //         "tournaments.name",
  //         "tournaments.id"
  //       );

  //     // If tournament_id is provided, filter by tournament
  //     if (tournament_id) {
  //       query = query.where("matches.tournament_id", tournament_id);
  //     }

  //     // switch (category) {
  //     //   case "recommended":
  //     //     query = query
  //     //       .whereRaw("LOWER(matches.status) = ?", ["ns"])
  //     //       // .orderBy("matches.start_time", "asc");
  //     //       .orderBy("contest_count", "desc")
  //     //     break;

  //     //   case "startingSoon":
  //     //     query = query
  //     //       // .whereRaw("LOWER(matches.status) = ?", ["ns"])
  //     //       // .orderBy("matches.start_time", "asc");
  //     //       .where("matches.start_time", "<=", next24Hours)
  //     //     .orderBy("matches.start_time", "asc");
  //     //     break;

  //     //   case "popular":
  //     //     query = query
  //     //       // .whereRaw("LOWER(matches.status) = ?", ["ns"])
  //     //       // .orderBy("matches.start_time", "asc");
  //     //       .orderBy("contest_count", "desc")
  //     //     .orderBy("total_prize_pool", "desc");
  //     //     break;

  //     //   default:
  //     //     return apiResponse.ErrorResponse(res, MATCH.invalidCategory);
  //     // }
  //     switch (category) {
  //       case "recommended":
  //         query = query
  //           .whereIn("matches.status", UPCOMING)
  //           .orderByRaw(
  //             `
  //             CASE 
  //               WHEN matches.status IN ('Live', '1st Innings', '2nd Innings', '3rd Innings') THEN 1 
  //               ELSE 2 
  //             END ASC
  //           `
  //           )
  //           .orderBy("contest_count", "desc")
  //           .orderBy("total_prize_pool", "desc")
  //           .orderBy("matches.start_time", "asc");
  //         break;

  //       case "startingSoon":
  //         query = query
  //           .whereIn("matches.status", UPCOMING)
  //           .andWhere("matches.start_time", ">=", now)
  //           .andWhere("matches.start_time", "<=", next24Hours)
  //           .orderBy("matches.start_time", "asc");
  //         break;

  //       case "popular":
  //         query = query
  //           .whereNotIn("matches.status", EXCLUDE)
  //           .orderBy("contest_count", "desc")
  //           .orderBy("total_prize_pool", "desc")
  //           .orderBy("matches.start_time", "asc");
  //         break;

  //       default:
  //         return apiResponse.ErrorResponse(res, MATCH.invalidCategory);
  //     }

  //     const matches = await query;

  //     const matchIds = matches.map((match) => match.id);

  //     // Get top players for each match
  //     const topPlayers = await knex("players")
  //       .select(
  //         "players.id",
  //         "players.name",
  //         "players.points",
  //         "players.credits",
  //         "teams.id as team_id",
  //         "teams.name as team_name",
  //         "matches.id as match_id"
  //       )
  //       .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //       .leftJoin("teams", "player_teams.team_id", "teams.id")
  //       .leftJoin("matches", function () {
  //         this.on(function () {
  //           this.on("teams.id", "=", "matches.team1_id").orOn(
  //             "teams.id",
  //             "=",
  //             "matches.team2_id"
  //           );
  //         });
  //       })
  //       .whereIn("matches.id", matchIds)
  //       .orderBy(["matches.id", "players.points"])
  //       .then((players) => {
  //         const matchTopPlayers = {};
  //         players.forEach((player) => {
  //           if (
  //             !matchTopPlayers[player.match_id] ||
  //             (player.points &&
  //               player.points > matchTopPlayers[player.match_id].points)
  //           ) {
  //             matchTopPlayers[player.match_id] = {
  //               name: player.name,
  //               points: player.points || 0,
  //               credits: player.credits || 0,
  //             };
  //           }
  //         });
  //         return matchTopPlayers;
  //       });

  //     // If no top players found by points, get any player from both teams
  //     const fallbackPlayers = await knex("players")
  //       .select(
  //         "players.id",
  //         "players.name",
  //         "teams.id as team_id",
  //         "teams.name as team_name",
  //         "matches.id as match_id"
  //       )
  //       .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //       .leftJoin("teams", "player_teams.team_id", "teams.id")
  //       .leftJoin("matches", function () {
  //         this.on(function () {
  //           this.on("teams.id", "=", "matches.team1_id").orOn(
  //             "teams.id",
  //             "=",
  //             "matches.team2_id"
  //           );
  //         });
  //       })
  //       .whereIn("matches.id", matchIds)
  //       .orderBy(["matches.id", "players.name"])
  //       .then((players) => {
  //         const matchFallbackPlayers = {};
  //         players.forEach((player) => {
  //           if (!matchFallbackPlayers[player.match_id]) {
  //             matchFallbackPlayers[player.match_id] = {
  //               name: player.name,
  //               points: 0,
  //               credits: 0,
  //             };
  //           }
  //         });
  //         return matchFallbackPlayers;
  //       });
  //     const liveSet = new Set(LIVE.map((s) => s.toLowerCase()));
  //     const matchesWithTimeAgo = matches.map((match) => {
  //       const { total_prize_pool, ...rest } = match;

  //       const topPlayer = topPlayers[match.id] || fallbackPlayers[match.id];

  //       return {
  //         ...rest,
  //         time_ago: moment(match.start_time).fromNow(),
  //         top_player: topPlayer?.name || null,
  //         prize_pool: parseInt(total_prize_pool) || 0,
  //         islive: liveSet.has(String(match.status || "").toLowerCase()),
  //       };
  //     });

  //     let matchesWithNotification = matchesWithTimeAgo;
  //     if (req.user && req.user.id) {
  //       const userId = req.user.id;
  //       const matchIds = matchesWithTimeAgo.map((m) => m.id);
  //       let notificationsMap = new Map();
  //       if (matchIds.length > 0) {
  //         const notifications = await knex("notifications")
  //           .whereIn("match_id", matchIds)
  //           .andWhere({ user_id: userId, status: true });
  //         notificationsMap = new Map(
  //           notifications.map((n) => [n.match_id, true])
  //         );
  //       }
  //       matchesWithNotification = matchesWithTimeAgo.map((match) => ({
  //         ...match,
  //         is_match_notification: !!notificationsMap.get(match.id),
  //       }));
  //     }

  //     const { getLanguage } = require("../../utils/responseMsg");
  //     const { translateTo } = require("../../utils/google");

  //     const lang =
  //       getLanguage().toLowerCase() === "hn"
  //         ? "hi"
  //         : getLanguage().toLowerCase();

  //     const translated = await Promise.all(
  //       matchesWithNotification.map(async (match) => {
  //         const translatedName = await translateTo(match.tournament_name, lang);
  //         return {
  //           ...match,
  //           tournament_name: translatedName,
  //         };
  //       })
  //     );

  //     return apiResponse.successResponseWithData(
  //       res,
  //       SUCCESS.dataFound,
  //       translated
  //     );
  //   } catch (error) {
  //     console.error(error);
  //     return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  //   }
  // },


  async getAllmatchesOfTournament(req, res) {
    try {
      const { tournament_id, category } = req.params;
      const userid = req.user?.id;
      const seasonRow = await knex("tournaments")
      .select("season")
      .where("id", tournament_id)
      .first();

    if (!seasonRow) {
      return apiResponse.ErrorResponse(res, "Tournament not found");
    }
    const seasonId = seasonRow.season;
  
      // Time windows
      const today = moment().startOf("day").toDate();
      const oneMonthLater = moment().add(1, "months").endOf("day").toDate();
      const next24Hours = moment().add(24, "hours").toDate();
      const now = moment().toDate();
  
      const UPCOMING = [
        "NS",
        "Delayed",
        "Not Started",
        "1st Innings",
        "2nd Innings",
        "3rd Innings",
        "4th Innings",
        "Live",
        "Stump Day 1", "Stump Day 2", "Stump Day 3", "Stump Day 4",
        "Innings Break", "Tea Break", "Lunch", "Dinner",
      ];
      const LIVE = [
        "1st Innings", "2nd Innings", "3rd Innings", "4th Innings",
        "Stump Day 1", "Stump Day 2", "Stump Day 3", "Stump Day 4",
        "Innings Break", "Tea Break", "Lunch", "Dinner", "Live"
      ];
      const EXCLUDE = ["Finished", "Completed","Cancl.","Cancl"];

  
      // Base query (1 month window)
      let query = knex("matches")
        .select(
          "matches.id",
          "matches.sm_match_id as sm_match_id",
          "matches.id as match_id",
          "tournaments.id as tournament_id",
  
          "t1.id as team1_id",
          "t1.logo_url as team1_logo_url",
          "t2.id as team2_id",
          "t2.logo_url as team2_logo_url",
          "t1.name as team1_name",
          "t1.short_name as team1_shortName",
          "t2.name as team2_name",
          "t2.short_name as team2_shortName",
  
          "matches.match_number",
          "matches.match_type",
          "matches.start_time",
          "matches.status",
          "tournaments.name as tournament_name",
  
          knex.raw(
            "COALESCE(SUM(CAST(contests.prize_pool::text AS NUMERIC)), 0) as total_prize_pool"
          ),
          knex.raw("COUNT(contests.id) as contest_count")
        )
        .where("matches.tournament_id", tournament_id)
        .whereNotNull("t1.name")
        .whereNotNull("t2.name")
        .whereNotNull("t1.id")
        .whereNotNull("t2.id")
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
        .leftJoin("contests", "matches.id", "contests.match_id")
        .whereBetween("matches.start_time", [today, oneMonthLater])
        .whereExists(function () {
          this.select("*")
            .from("player_teams")
            .whereRaw("player_teams.team_id = matches.team1_id")
            .andWhere("player_teams.season_id", seasonId);
        })
        .whereExists(function () {
          this.select("*")
            .from("player_teams")
            .whereRaw("player_teams.team_id = matches.team2_id")
            .andWhere("player_teams.season_id", seasonId);
        })
        .groupBy(
          "matches.id",
          "matches.match_number",
          "matches.match_type",
          "matches.start_time",
          "matches.status",
          "t1.id",
          "t2.id",
          "t1.name",
          "t1.short_name",
          "t2.name",
          "t2.short_name",
          "tournaments.name",
          "tournaments.id"
        );
  
      // Category filters
      switch (category) {
        case "recommended":
          query = query
            .whereIn("matches.status", UPCOMING)
            .orderByRaw(`
              CASE 
                WHEN matches.status IN ('Live', '1st Innings', '2nd Innings', '3rd Innings','4th Innings') THEN 1 
                ELSE 2 
              END ASC
            `)
            .orderBy("contest_count", "desc")
            .orderBy("total_prize_pool", "desc")
            .orderBy("matches.start_time", "asc");
          break;
  
        case "startingSoon":
          query = query
            .whereIn("matches.status", UPCOMING)
            .andWhere("matches.start_time", ">=", now)
            .andWhere("matches.start_time", "<=", next24Hours)
            .orderBy("matches.start_time", "asc");
          break;
  
        case "popular":
          query = query
            .whereNotIn("matches.status", EXCLUDE)
            .orderBy("contest_count", "desc")
            .orderBy("total_prize_pool", "desc")
            .orderBy("matches.start_time", "asc");
          break;
  
        default:
          return apiResponse.ErrorResponse(res, MATCH.invalidCategory);
      }
  
      // Fetch matches
      let matches = await query;
  
      // =========================
      // Keep ONLY matches whose BOTH teams have players in DB
      // =========================
      if (matches.length > 0) {
        const teamIds = [
          ...new Set(matches.flatMap((m) => [m.team1_id, m.team2_id])),
        ];
  
        // Which teams have at least 1 player linked?
        const teamsWithPlayers = await knex("player_teams")
          .select("team_id")
          .whereIn("team_id", teamIds)
          .groupBy("team_id")
          .pluck("team_id");
  
        const teamHasPlayers = new Set(teamsWithPlayers);
  
        matches = matches.filter(
          (m) => teamHasPlayers.has(m.team1_id) && teamHasPlayers.has(m.team2_id)
        );
      }
  
      // Early exit if nothing left after filtering
      if (matches.length === 0) {
        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, []);
      }
  
      // =========================
      // Top Players (by points) per match
      // =========================
      const filteredMatchIds = matches.map((m) => m.id);
  
      // Top by points
      const topPlayersRows =
        filteredMatchIds.length === 0
          ? []
          : await knex("players")
              .select(
                "players.id",
                "players.name",
                "players.points",
                "players.credits",
                "matches.id as match_id"
              )
              .leftJoin("player_teams", "players.id", "player_teams.player_id")
              .leftJoin("teams", "player_teams.team_id", "teams.id")
              .leftJoin("matches", function () {
                this.on(function () {
                  this.on("teams.id", "=", "matches.team1_id").orOn(
                    "teams.id",
                    "=",
                    "matches.team2_id"
                  );
                });
              })
              .whereIn("matches.id", filteredMatchIds)
              .orderBy("matches.id", "asc")
              .orderBy("players.points", "desc");
  
      const topPlayersByMatch = {};
      for (const row of topPlayersRows) {
        if (!row.match_id) continue;
        // first row per match_id has the highest points due to ordering
        if (!topPlayersByMatch[row.match_id]) {
          topPlayersByMatch[row.match_id] = {
            name: row.name,
            points: row.points || 0,
            credits: row.credits || 0,
          };
        }
      }
  
      // Fallback player per match (any player if points missing everywhere)
      const fallbackRows =
        filteredMatchIds.length === 0
          ? []
          : await knex("players")
              .select(
                "players.id",
                "players.name",
                "matches.id as match_id"
              )
              .leftJoin("player_teams", "players.id", "player_teams.player_id")
              .leftJoin("teams", "player_teams.team_id", "teams.id")
              .leftJoin("matches", function () {
                this.on(function () {
                  this.on("teams.id", "=", "matches.team1_id").orOn(
                    "teams.id",
                    "=",
                    "matches.team2_id"
                  );
                });
              })
              .whereIn("matches.id", filteredMatchIds)
              .orderBy("matches.id", "asc")
              .orderBy("players.name", "asc");
  
      const fallbackByMatch = {};
      for (const row of fallbackRows) {
        if (!row.match_id) continue;
        if (!fallbackByMatch[row.match_id]) {
          fallbackByMatch[row.match_id] = {
            name: row.name,
            points: 0,
            credits: 0,
          };
        }
      }
  
      // =========================
      // Compose final payload
      // =========================
      const liveSet = new Set(LIVE.map((s) => s.toLowerCase()));
      const matchesWithTimeAgo = matches.map((match) => {
        const { total_prize_pool, ...rest } = match;
  
        const topPlayer =
          topPlayersByMatch[match.id] || fallbackByMatch[match.id] || null;
  
        return {
          ...rest,
          time_ago: moment(match.start_time).fromNow(),
          top_player: topPlayer?.name || null,
          prize_pool: parseInt(total_prize_pool) || 0,
          islive: liveSet.has(String(match.status || "").toLowerCase()),
        };
      });
  
      // Notifications
      let matchesWithNotification = matchesWithTimeAgo;
      if (req.user && req.user.id) {
        const userId = req.user.id;
        const matchIds = matchesWithTimeAgo.map((m) => m.id);
  
        let notificationsMap = new Map();
        if (matchIds.length > 0) {
          const notifications = await knex("notifications")
            .whereIn("match_id", matchIds)
            .andWhere({ user_id: userId, status: true });
  
          notificationsMap = new Map(notifications.map((n) => [n.match_id, true]));
        }
  
        matchesWithNotification = matchesWithTimeAgo.map((match) => ({
          ...match,
          is_match_notification: !!notificationsMap.get(match.id),
        }));
      }
  
      // i18n
      const { getLanguage } = require("../../utils/responseMsg");
      const { translateTo } = require("../../utils/google");
      const lang =
        getLanguage().toLowerCase() === "hn"
          ? "hi"
          : getLanguage().toLowerCase();
  
      const translated = await Promise.all(
        matchesWithNotification.map(async (match) => {
          const translatedName = await translateTo(match.tournament_name, lang);
          return {
            ...match,
            tournament_name: translatedName,
          };
        })
      );
  
      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        translated
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },  
  async getLiveMatches(req, res) {
    try {
      const matches = await knex("matches")
        .select(
          "matches.*",
          "t1.name as team1_name",
          "t1.short_name as team1_short_name",
          "t2.name as team2_name",
          "t2.short_name as team2_short_name"
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .where("matches.status", "Live")
        // .where("matches.is_visible", true)
        .orderBy("matches.start_time", "desc");

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        matches
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getCompletedMatches(req, res) {
    try {
      const matches = await knex("matches")
        .select(
          "matches.*",
          "t1.name as team1_name",
          "t1.short_name as team1_short_name",
          "t2.name as team2_name",
          "t2.short_name as team2_short_name",
          "tw.name as winning_team_name"
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .leftJoin(
          "teams as tw",
          knex.raw("(matches.metadata->>'winner_team_id')::int"),
          "tw.id"
        )
        .where("matches.status", "Finished")
        // .where("matches.is_visible", true)
        .orderBy("matches.start_time", "desc")
        .limit(10);

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        matches
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMatchDetails(req, res) {
    try {
      const { id } = req.params;
   

      const match = await knex("matches")
        .select(
          "matches.*",
          "t1.name as team1_name",
          "t1.short_name as team1_short_name",
          "t2.name as team2_name",
          "t2.short_name as team2_short_name",
          "tw.name as winning_team_name"
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .leftJoin("teams as tw", "matches.victory_team_id", "tw.id")
        .where("matches.id", id)
        // .where("matches.is_visible", true)
        .first();

      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, match);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMatchScorecard(req, res) {
    try {
      const { id } = req.params;

      // Get match details
      const match = await knex("matches")
        .where("id", id)
        .where("is_visible", true)
        .first();

      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      // Get player stats for the match
      const playerStats = await knex("player_stats")
        .select(
          "player_stats.*",
          "players.name as player_name",
          "players.role as player_role",
          "teams.name as team_name"
        )
        .leftJoin("players", "player_stats.player_id", "players.id")
        .leftJoin("teams", "players.team_id", "teams.id")
        .where("player_stats.match_id", id)
        .orderBy([
          { column: "teams.name", order: "asc" },
          { column: "player_stats.fantasy_points", order: "desc" },
        ]);

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        playerStats,
        match,
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // async getMatchPlayers(req, res) {
  //   try {
  //     // Import required modules
  //     const tournamentDbService = require("../../services/tournamentDbService");
  //     const sportmonksService = require("../../services/sportmonksService");

  //     const { matchId } = req.params;
  //     console.log(`[getMatchPlayers] Starting for match ID: ${matchId} at ${new Date().toISOString()}`);

  //     // Get match info
  //     const match = await knex("matches")
  //       .select(
  //         "matches.id",
  //         "matches.sm_match_id as sm_match_id",
  //         "matches.team1_id",
  //         "matches.team2_id",
  //         "t1.name as team1_name",
  //         "t1.short_name as team1_short_name",
  //         "t1.team_id as team1_sm_id", // SportMonks ID
  //         "t2.name as team2_name",
  //         "t2.short_name as team2_short_name",
  //         "t2.team_id as team2_sm_id", // SportMonks ID
  //         "tournaments.id as tournament_id",
  //         "tournaments.season"
  //       )
  //       .leftJoin("teams as t1", "matches.team1_id", "t1.id")
  //       .leftJoin("teams as t2", "matches.team2_id", "t2.id")
  //       .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
  //       .where("matches.id", matchId)
  //       .first();

  //     if (!match) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Match not found",
  //       });
  //     }

  //     console.log(
  //       `Match details - team1: ${match.team1_name} (ID: ${match.team1_id}, SM ID: ${match.team1_sm_id}), team2: ${match.team2_name} (ID: ${match.team2_id}, SM ID: ${match.team2_sm_id}), sm_match_id: ${match.sm_match_id}`
  //     );

  //     // Try to fetch lineup from SportMonks for this fixture
  //     let lineupSmPlayerIds = [];
  //     let smIdToSubstitute = {};
  //     try {
  //       const lineupResp = await sportmonksService.getMatchLineup(
  //         match.sm_match_id
  //       );
  //       console.log("lineup", lineupResp);
  //       if (lineupResp && Array.isArray(lineupResp)) {
  //         // getMatchLineup (older version) may return array directly
  //         lineupSmPlayerIds = lineupResp.map((p) => String(p.id));
  //         lineupResp.forEach((p) => {
  //           smIdToSubstitute[String(p.id)] = Boolean(p.lineup?.substitution);
  //         });
  //       } else if (
  //         lineupResp &&
  //         lineupResp.success &&
  //         Array.isArray(lineupResp.data)
  //       ) {
  //         // getMatchLineup (newer version) returns { success, data, playerIds }
  //         lineupSmPlayerIds = (
  //           lineupResp.playerIds || lineupResp.data.map((p) => String(p.id))
  //         ).map(String);
  //         lineupResp.data.forEach((p) => {
  //           smIdToSubstitute[String(p.id)] = Boolean(p.lineup?.substitution);
  //         });
  //       }
  //       if (lineupSmPlayerIds.length) {
  //         console.log(
  //           `Lineup found for match ${match.sm_match_id}: ${lineupSmPlayerIds.length} players`
  //         );
  //       } else {
  //         console.log(`No lineup found for match ${match.sm_match_id}`);
  //       }
  //     } catch (e) {
  //       console.log(
  //         `Lineup fetch error for sm_match_id ${match.sm_match_id}:`,
  //         e.message || e
  //       );
  //     }

  //     // Check if we have players for both teams
  //     const team1Players = await knex("players")
  //       .select("players.id")
  //       .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //       .where("player_teams.team_id", match.team1_id);

  //     const team2Players = await knex("players")
  //       .select("players.id")
  //       .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //       .where("player_teams.team_id", match.team2_id);

  //     console.log(
  //       `Team1 (${match.team1_name}) players: ${team1Players.length}`
  //     );
  //     console.log(
  //       `Team2 (${match.team2_name}) players: ${team2Players.length}`
  //     );

  //     // If either team has no players, try to sync them
  //     if (team1Players.length === 0 || team2Players.length === 0) {
  //       console.log(`Missing players for teams. Attempting to sync...`);

  //       const seasonId = match.season;

  //       if (seasonId) {
  //         // Sync players for teams with missing players
  //         if (team1Players.length === 0) {
  //           const team1 = await knex("teams")
  //             .where({ id: match.team1_id })
  //             .first();
  //           if (team1 && team1.team_id) {
  //             try {
  //               console.log(
  //                 `Syncing players for ${team1.name} (ID: ${team1.id}, SM ID: ${team1.team_id})`
  //               );
  //               const squadResponse =
  //                 await sportmonksService.getTeamSquadservice(
  //                   team1.team_id,
  //                   seasonId
  //                 );
  //               if (squadResponse && squadResponse.data) {
  //                 await tournamentDbService.insertTeamSquad(
  //                   squadResponse.data,
  //                   knex,
  //                   team1.id
  //                 );
  //                 console.log(`Successfully synced players for ${team1.name}`);
  //               } else {
  //                 console.log(`No squad data returned for ${team1.name}`);
  //               }
  //             } catch (error) {
  //               console.error(
  //                 `Error syncing players for ${team1.name}:`,
  //                 error
  //               );
  //             }
  //           } else {
  //             console.error(
  //               `Team1 not found or missing team_id: ${match.team1_id}`
  //             );
  //           }
  //         }

  //         if (team2Players.length === 0) {
  //           const team2 = await knex("teams")
  //             .where({ id: match.team2_id })
  //             .first();
  //           if (team2 && team2.team_id) {
  //             try {
  //               console.log(
  //                 `Syncing players for ${team2.name} (ID: ${team2.id}, SM ID: ${team2.team_id})`
  //               );
  //               const squadResponse =
  //                 await sportmonksService.getTeamSquadservice(
  //                   team2.team_id,
  //                   seasonId
  //                 );
  //               if (squadResponse && squadResponse.data) {
  //                 await tournamentDbService.insertTeamSquad(
  //                   squadResponse.data,
  //                   knex,
  //                   team2.id
  //                 );
  //                 console.log(`Successfully synced players for ${team2.name}`);
  //               } else {
  //                 console.log(`No squad data returned for ${team2.name}`);
  //               }
  //             } catch (error) {
  //               console.error(
  //                 `Error syncing players for ${team2.name}:`,
  //                 error
  //               );
  //             }
  //           } else {
  //             console.error(
  //               `Team2 not found or missing team_id: ${match.team2_id}`
  //             );
  //           }
  //         }
  //       } else {
  //         console.error(
  //           `Season ID not found for tournament ID: ${match.tournament_id}`
  //         );
  //       }
  //     }

  //     // IMPORTANT: After syncing, we need to check the player_teams table
  //     console.log("Checking player_teams table after sync...");

  //     // Check if there are entries in player_teams with the correct team_id
  //     const team1PlayerTeams = await knex("player_teams")
  //       .where("team_id", match.team1_id)
  //       .count("* as count")
  //       .first();

  //     const team2PlayerTeams = await knex("player_teams")
  //       .where("team_id", match.team2_id)
  //       .count("* as count")
  //       .first();

  //     console.log(
  //       `player_teams entries with team_id - team1: ${team1PlayerTeams.count}, team2: ${team2PlayerTeams.count}`
  //     );

  //     // Check if there are entries in player_teams with the sm_team_id
  //     const team1PlayerTeamsBySM = await knex("player_teams")
  //       .where("sm_team_id", String(match.team1_sm_id))
  //       .count("* as count")
  //       .first();

  //     const team2PlayerTeamsBySM = await knex("player_teams")
  //       .where("sm_team_id", String(match.team2_sm_id))
  //       .count("* as count")
  //       .first();

  //     console.log(
  //       `player_teams entries with sm_team_id - team1: ${team1PlayerTeamsBySM.count}, team2: ${team2PlayerTeamsBySM.count}`
  //     );

  //     // If we have players linked by sm_team_id but not by team_id, we need to fix the player_teams entries
  //     if (
  //       (team1Players.length === 0 && team1PlayerTeamsBySM.count > 0) ||
  //       (team2Players.length === 0 && team2PlayerTeamsBySM.count > 0)
  //     ) {
  //       console.log("Fixing player_teams entries...");

  //       // Fix team1 players
  //       if (team1Players.length === 0 && team1PlayerTeamsBySM.count > 0) {
  //         await knex("player_teams")
  //           .where("sm_team_id", String(match.team1_sm_id))
  //           .update({ team_id: match.team1_id });

  //         console.log(
  //           `Updated ${team1PlayerTeamsBySM.count} player_teams entries for team1`
  //         );
  //       }

  //       // Fix team2 players
  //       if (team2Players.length === 0 && team2PlayerTeamsBySM.count > 0) {
  //         await knex("player_teams")
  //           .where("sm_team_id", String(match.team2_sm_id))
  //           .update({ team_id: match.team2_id });

  //         console.log(
  //           `Updated ${team2PlayerTeamsBySM.count} player_teams entries for team2`
  //         );
  //       }
  //     }

  //     // Now get players for the match
  //     // If lineup exists, restrict to those SportMonks player_ids; else fetch full squads
  //     console.log("Querying players for match teams:", {
  //       team1_id: match.team1_id,
  //       team1_name: match.team1_name,
  //       team2_id: match.team2_id,
  //       team2_name: match.team2_name
  //     });

  //     let playersQuery = knex("players")
  //       .select(
  //         "players.id",
  //         "players.name",
  //         "players.player_id",
  //         "players.role",
  //         "players.points",
  //         "players.credits",
  //         "players.metadata",
  //         "players.is_played_last_match",
  //         "players.selected_by_percentage",
  //         "teams.id as team_id",
  //         "teams.name as team_name",

  //         knex.raw("mp.is_playing_xi as mp_is_playing_xi"),
  //         knex.raw("mp.is_substitute as mp_is_substitute"),
  //         knex.raw("mp.is_captain as mp_is_captain"),
  //         knex.raw("mp.is_wicketkeeper as mp_is_wicketkeeper")
  //       )
  //       .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //       .leftJoin("teams", "player_teams.team_id", "teams.id")
  //       .leftJoin("match_players as mp", function () {
  //         this.on("mp.player_id", "=", "players.id").andOn(
  //           "mp.match_id",
  //           "=",
  //           knex.raw("?", [match.id])
  //         );
  //       })
  //       .whereIn("player_teams.team_id", [match.team1_id, match.team2_id]); // Only players from the actual match teams

  //     if (lineupSmPlayerIds.length) {
  //       playersQuery = playersQuery.whereIn(
  //         "players.player_id",
  //         lineupSmPlayerIds
  //       );
  //     }

  //     const playersRaw = await playersQuery.orderBy([
  //       "teams.name",
  //       "players.name",
  //     ]);

  //     // Debug: Show what teams the players actually belong to
  //     const playerTeams = [...new Set(playersRaw.map(p => p.team_name))];
  //     console.log("Players returned from query:", {
  //       totalPlayers: playersRaw.length,
  //       playerTeams: playerTeams,
  //       expectedTeams: [match.team1_name, match.team2_name]
  //     });

  //     // Deduplicate by players.id just in case of multiple team links
  //     const seen = new Set();
  //     const players = [];
  //     for (const row of playersRaw) {
  //       if (!seen.has(row.id)) {
  //         seen.add(row.id);
  //         players.push(row);
  //       }
  //     }

  //     console.log(`After sync - Total players: ${players.length}`);

  //     // Upsert match_players statuses based on lineup (hybrid flow)
  //     try {
  //       console.log(`Starting match_players upsert for match ${match.id} with ${lineupSmPlayerIds.length} lineup players`);

  //       // Small delay to prevent race conditions with cron jobs
  //       await new Promise(resolve => setTimeout(resolve, 100));

  //       // Seed/probable: ensure all squad players have a row when no lineup yet
  //       if (!lineupSmPlayerIds.length) {
  //         console.log(`No lineup available, seeding probable players for match ${match.id}`);

  //         // Create rows as probable (is_playing_xi=false, is_substitute=false) if not exist
  //         const squadDbPlayers = await knex("players")
  //           .select("players.id")
  //           .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //           .whereIn("player_teams.team_id", [match.team1_id, match.team2_id]);

  //         const existingRows = await knex("match_players")
  //           .select("player_id")
  //           .where({ match_id: match.id });
  //         const existingSet = new Set(
  //           existingRows.map((r) => Number(r.player_id))
  //         );

  //         const newRows = squadDbPlayers
  //           .map((p) => Number(p.id))
  //           .filter((id) => !existingSet.has(id))
  //           .map((player_id) => ({
  //             match_id: match.id,
  //             player_id,
  //             is_playing_xi: false,
  //             is_substitute: false,
  //             is_captain: false,
  //             is_wicketkeeper: false,
  //             created_at: new Date(),
  //             updated_at: new Date(),
  //           }));

  //         if (newRows.length) {
  //           console.log(`Processing ${newRows.length} players for match ${match.id}`);

  //           // Use batch upsert to handle conflicts
  //           const batchSize = 50;
  //           for (let i = 0; i < newRows.length; i += batchSize) {
  //             const batch = newRows.slice(i, i + batchSize);

  //             try {
  //               // Use proper upsert for each batch
  //               await knex('match_players')
  //                 .insert(batch)
  //                 .onConflict(['match_id', 'player_id'])
  //                 .merge({
  //                   is_playing_xi: knex.raw('EXCLUDED.is_playing_xi'),
  //                   is_substitute: knex.raw('EXCLUDED.is_substitute'),
  //                   is_captain: knex.raw('EXCLUDED.is_captain'),
  //                   is_wicketkeeper: knex.raw('EXCLUDED.is_wicketkeeper'),
  //                   updated_at: new Date()
  //                 });

  //               console.log(`Upserted batch ${i/batchSize + 1} (${batch.length} players)`);
  //             } catch (batchError) {
  //               console.error(`Batch ${i/batchSize + 1} failed:`, batchError.message);

  //               // Fallback: individual upsert for failed batch
  //               for (const row of batch) {
  //                 try {
  //                   await knex('match_players')
  //                     .insert(row)
  //                     .onConflict(['match_id', 'player_id'])
  //                     .merge({
  //                       is_playing_xi: row.is_playing_xi,
  //                       is_substitute: row.is_substitute,
  //                       is_captain: row.is_captain,
  //                       is_wicketkeeper: row.is_wicketkeeper,
  //                       updated_at: new Date()
  //                     });
  //                 } catch (individualError) {
  //                   console.warn(`Failed to upsert player ${row.player_id}:`, individualError.message);
  //                 }
  //               }
  //             }
  //           }
  //         } else {
  //           console.log(`All probable players already exist for match ${match.id}`);
  //         }
  //       } else {
  //         console.log(`Lineup available, upserting ${lineupSmPlayerIds.length} players for match ${match.id}`);

  //         // Update starters and mark non-listed as not playing
  //         // Map SM ids -> DB ids
  //         const dbPlayersForLineup = await knex("players")
  //           .select("players.id", "players.player_id")
  //           .whereIn("players.player_id", lineupSmPlayerIds);
  //         const lineupDbIds = dbPlayersForLineup.map((p) => Number(p.id));

  //         // Prepare upsert data for all players
  //         const allSquadDb = await knex("players")
  //           .select("players.id")
  //           .leftJoin("player_teams", "players.id", "player_teams.player_id")
  //           .whereIn("player_teams.team_id", [match.team1_id, match.team2_id]);

  //         const allSquadIds = allSquadDb.map((p) => Number(p.id));

  //         // Create upsert rows for all players
  //         const upsertRows = allSquadIds.map((player_id) => {
  //           const isInLineup = lineupDbIds.includes(player_id);
  //           const isSub = isInLineup ? Boolean(smIdToSubstitute[String(player_id)]) : false;

  //           return {
  //             match_id: match.id,
  //             player_id,
  //             is_playing_xi: isInLineup && !isSub,
  //             is_substitute: isInLineup && isSub,
  //             is_captain: false, // Will be updated by lineup sync if available
  //             is_wicketkeeper: false, // Will be updated by lineup sync if available
  //             created_at: new Date(),
  //             updated_at: new Date(),
  //           };
  //         });

  //         if (upsertRows.length) {
  //           console.log(`Upserting ${upsertRows.length} players for match ${match.id}`);

  //           // Use proper upsert to avoid duplicate key errors
  //           const batchSize = 50;
  //           for (let i = 0; i < upsertRows.length; i += batchSize) {
  //             const batch = upsertRows.slice(i, i + batchSize);

  //             try {
  //               await knex('match_players')
  //                 .insert(batch)
  //                 .onConflict(['match_id', 'player_id'])
  //                 .merge({
  //                   is_playing_xi: knex.raw('EXCLUDED.is_playing_xi'),
  //                   is_substitute: knex.raw('EXCLUDED.is_substitute'),
  //                   is_captain: knex.raw('EXCLUDED.is_captain'),
  //                   is_wicketkeeper: knex.raw('EXCLUDED.is_wicketkeeper'),
  //                   updated_at: new Date()
  //                 });

  //               console.log(`Upserted batch ${i/batchSize + 1} (${batch.length} players)`);
  //             } catch (batchError) {
  //               console.error(`Batch ${i/batchSize + 1} failed:`, batchError.message);

  //               // Fallback: individual upsert for failed batch
  //               for (const row of batch) {
  //                 try {
  //                   await knex('match_players')
  //                     .insert(row)
  //                     .onConflict(['match_id', 'player_id'])
  //                     .merge({
  //                       is_playing_xi: row.is_playing_xi,
  //                       is_substitute: row.is_substitute,
  //                       is_captain: row.is_captain,
  //                       is_wicketkeeper: row.is_wicketkeeper,
  //                       updated_at: new Date()
  //                     });
  //                 } catch (individualError) {
  //                   console.warn(`Failed to upsert player ${row.player_id}:`, individualError.message);
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       }
  //     } catch (lineupDbErr) {
  //       console.error(
  //         `Error in match_players upsert for match ${match.id}:`,
  //         lineupDbErr.message || lineupDbErr
  //       );
  //       // Continue execution even if upsert fails
  //     }

  //     // Get fantasy teams count
  //     const totalTeams = await knex("fantasy_teams")
  //       .where("match_id", matchId)
  //       .count("id as count")
  //       .first();
  //     const totalTeamsCount = parseInt(totalTeams.count) || 1;

  //     // Get player IDs for further queries
  //     const dbPlayerIds = players.map((p) => p.id);

  //     // Get substitute status
  //     const substituteStatus = await knex("fantasy_team_players as ftp")
  //       .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
  //       .where("ft.match_id", matchId)
  //       .whereIn("ftp.player_id", dbPlayerIds)
  //       .select("ftp.player_id", "ftp.substitute")
  //       .groupBy("ftp.player_id", "ftp.substitute");

  //     const substituteMap = {};
  //     substituteStatus.forEach((stat) => {
  //       substituteMap[stat.player_id] = stat.substitute;
  //     });

  //     // Get captain/vice-captain stats
  //     const capVcStatsArr = await knex("fantasy_team_players as ftp")
  //       .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
  //       .leftJoin(
  //         "fantasy_games as fg",
  //         "ftp.fantasy_team_id",
  //         "fg.fantasy_team_id"
  //       )
  //       .where("ft.match_id", matchId)
  //       .whereIn("ftp.player_id", dbPlayerIds)
  //       .select(
  //         "ftp.player_id",
  //         knex.raw(
  //           "SUM(CASE WHEN ftp.is_captain THEN 1 ELSE 0 END) as captain_count"
  //         ),
  //         knex.raw(
  //           "SUM(CASE WHEN ftp.is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
  //         ),
  //         knex.raw(
  //           "COUNT(DISTINCT CASE WHEN ftp.is_captain OR ftp.is_vice_captain THEN fg.contest_id END) as contest_count"
  //         )
  //       )
  //       .groupBy("ftp.player_id");

  //     const capVcStats = {};
  //     capVcStatsArr.forEach((stat) => {
  //       capVcStats[stat.player_id] = {
  //         captain_count: parseInt(stat.captain_count) || 0,
  //         vice_captain_count: parseInt(stat.vice_captain_count) || 0,
  //         contest_count: parseInt(stat.contest_count) || 0,
  //       };
  //     });

  //     // Organize players by team
  //     const teamPlayers = {
  //       [match.team1_name]: [],
  //       [match.team2_name]: [],
  //     };

  //     // Debug: Show team organization
  //     console.log("Organizing players into teams:", {
  //       team1_name: match.team1_name,
  //       team2_name: match.team2_name,
  //       availableTeamNames: [...new Set(players.map(p => p.team_name))]
  //     });

  //     // Log player team distribution
  //     const team1Count = players.filter(
  //       (p) => p.team_id === match.team1_id
  //     ).length;
  //     const team2Count = players.filter(
  //       (p) => p.team_id === match.team2_id
  //     ).length;
  //     console.log(
  //       `Player distribution - ${match.team1_name}: ${team1Count}, ${match.team2_name}: ${team2Count}`
  //     );

  //     players.forEach((player) => {
  //       const teamName = player.team_name;
  //       if (!teamName) {
  //         console.log(
  //           `Player ${player.name} (ID: ${player.id}) has no team_name`
  //         );
  //         return;
  //       }

  //       // Debug: Show which team this player is being assigned to
  //       console.log(`Processing player ${player.name} (ID: ${player.id}) - team: ${teamName}, expected teams: [${match.team1_name}, ${match.team2_name}]`);

  //       // Validate that this player belongs to one of the match teams
  //       if (teamName !== match.team1_name && teamName !== match.team2_name) {
  //         console.log(`WARNING: Player ${player.name} (ID: ${player.id}) belongs to unexpected team: ${teamName}`);
  //         console.log(`Skipping this player as it doesn't belong to match teams: ${match.team1_name}, ${match.team2_name}`);
  //         return;
  //       }

  //       const stats = capVcStats[player.id] || {
  //         captain_count: 0,
  //         vice_captain_count: 0,
  //         contest_count: 0,
  //       };

  //       let team_short_name = null;
  //       if (teamName === match.team1_name) {
  //         team_short_name = match.team1_short_name;
  //       } else if (teamName === match.team2_name) {
  //         team_short_name = match.team2_short_name;
  //       }

  //       // If no team exists in teamPlayers, create it
  //       if (!teamPlayers[teamName]) {
  //         console.log(`Creating team entry for ${teamName} - this should not happen for match teams!`);
  //         console.log(`Expected teams: ${match.team1_name}, ${match.team2_name}`);
  //         console.log(`Player team_id: ${player.team_id}, match team1_id: ${match.team1_id}, match team2_id: ${match.team2_id}`);
  //         teamPlayers[teamName] = [];
  //       }

  //       teamPlayers[teamName].push({
  //         id: player.id,
  //         name: player.name,
  //         player_id: player.player_id,
  //         role: player.role,
  //         points: player.points,
  //         credits: player.credits,
  //         imagePath: player.metadata?.image_path || null,
  //         isPlayedLastMatch: player.is_played_last_match,
  //         selectedByPercentage: player.selected_by_percentage,
  //         captain_percentage: Math.floor(
  //           (stats.captain_count / totalTeamsCount) * 100
  //         ).toFixed(2),
  //         vice_captain_percentage: Math.floor(
  //           (stats.vice_captain_count / totalTeamsCount) * 100
  //         ).toFixed(2),
  //         contest_count: stats.contest_count,
  //         substitute: substituteMap[player.id] || false,
  //         is_playing_xi: Boolean(player.mp_is_playing_xi) || false,
  //         is_bench: Boolean(player.mp_is_substitute) || false,
  //         lineup_captain: Boolean(player.mp_is_captain) || false,
  //         lineup_wicketkeeper: Boolean(player.mp_is_wicketkeeper) || false,
  //         team_short_name,
  //         team: teamName,
  //       });
  //     });

  //     // Log the final counts
  //     console.log(
  //       `Final player counts - ${match.team1_name}: ${
  //         teamPlayers[match.team1_name]?.length || 0
  //       }, ${match.team2_name}: ${teamPlayers[match.team2_name]?.length || 0}`
  //     );

  //     console.log(`[getMatchPlayers] Completed successfully for match ID: ${match.id} at ${new Date().toISOString()}`);

  //     return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
  //       match_id: match.id,
  //       teams: {
  //         [match.team1_name]: teamPlayers[match.team1_name] || [],
  //         [match.team2_name]: teamPlayers[match.team2_name] || [],
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Error in getMatchPlayers:", error);
  //     return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  //   }
  // }
  async getMatchPlayers(req, res) {
    try {
      const { matchId } = req.params;

      const match = await knex("matches")
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

      const tournament = await knex("tournaments")
        .select("tournaments.id", "tournaments.metadata")
        .where("tournaments.id", match.tournament_id)
        .first();
        
        const metadata = typeof tournament.metadata === "string" 
  ? JSON.parse(tournament.metadata) 
  : tournament.metadata;




      const seasonId = metadata.season_id;

      const players = await knex("players")
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

      const totalTeams = await knex("fantasy_teams")
        .where("match_id", matchId)
        .count("id as count")
        .first();

      const totalTeamsCount = parseInt(totalTeams.count) || 1;

      const playerIds = players.map((p) => p.id);

      const substituteStatus = await knex("fantasy_team_players as ftp")
        .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
        .where("ft.match_id", matchId)
        .whereIn("ftp.player_id", playerIds)
        .select("ftp.player_id", "ftp.substitute")
        .groupBy("ftp.player_id", "ftp.substitute");

      const substituteMap = {};
      substituteStatus.forEach((stat) => {
        substituteMap[stat.player_id] = stat.substitute;
      });

      const capVcStatsArr = await knex("fantasy_team_players as ftp")
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
          knex.raw(
            "SUM(CASE WHEN ftp.is_captain THEN 1 ELSE 0 END) as captain_count"
          ),
          knex.raw(
            "SUM(CASE WHEN ftp.is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
          ),
          knex.raw(
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
      const getValidCredits = (credits) => {
        if (credits === null || credits === undefined) return "6.0";
        
        const creditValue = parseFloat(credits);
        
        // Check for invalid values (0, 0.0, NaN, or negative)
        if (isNaN(creditValue) || creditValue <= 0) return "6.0";
        
        return credits;
      };
      const getValidSelectedByPercentage = (percentage) => {
        if (percentage === null || percentage === undefined) return "0.00";
        
        const percentageValue = parseFloat(percentage);
        
        // Check for invalid values (NaN or negative)
        if (isNaN(percentageValue) || percentageValue < 0) return "0.00";
        
        return percentage;
      };
  
      // Helper function to get valid points with fallback
      const getValidPoints = (points) => {
        if (points === null || points === undefined) return 10;
        
        const pointsValue = parseInt(points);
        
        // Check for invalid values (NaN or negative)
        if (isNaN(pointsValue) || pointsValue < 0) return 10;
        
        return points;
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
          points: getValidPoints(player.points),
          credits: getValidCredits(player.credits),
          imagePath: player.metadata?.image_path || null,
          isPlayedLastMatch: player.is_played_last_match,
          selectedByPercentage: getValidSelectedByPercentage(player.selected_by_percentage),
          captain_percentage: Math.floor(
            (stats.captain_count / totalTeamsCount) * 100
          ).toFixed(2),
          vice_captain_percentage: Math.floor(
            (stats.vice_captain_count / totalTeamsCount) * 100
          ).toFixed(2),
          contest_count: stats.contest_count,
          // substitute: substituteMap[player.id] || false,
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
};

module.exports = matchController;
