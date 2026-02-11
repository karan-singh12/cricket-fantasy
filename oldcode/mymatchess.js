// services/matches.js
const { knex: db } = require("../config/database");
const config = require("../config/config");
const moment = require("moment");

// async function getUserMatches(userId, type = "all", matchId = null) {
//   try {
//     let query = db("fantasy_games as fg")
//       .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
//       .join("matches as m", "ft.match_id", "m.id")
//       .join("teams as t1", "m.team1_id", "t1.id")
//       .join("teams as t2", "m.team2_id", "t2.id")
//       .leftJoin("venues as v", "m.venue", "v.venue_id")
//       .leftJoin("countries as c", "v.country_id", "c.country_id")
//       .join("tournaments as tour", "m.tournament_id", "tour.id")
//       .where("fg.user_id", userId)
//       .select(
//         "m.*",
//         "v.city as city",
//         "c.name as country",
//         "t1.name as team1_name",
//         "t1.short_name as team1_short_name",
//         "t1.logo_url as team1_logo_url",
//         "t2.name as team2_name",
//         "t2.short_name as team2_short_name",
//         "t2.logo_url as team2_logo_url",
//         "tour.name as tournament_name"
//       )
//       .groupBy(
//         "m.id",
//         "t1.name",
//         "t1.short_name",
//         "t2.name",
//         "t2.short_name",
//         "v.city",
//         "c.name",
//         "tour.name",
//         "t1.logo_url",
//         "t2.logo_url"
//       );

//     if (matchId) {
//       query = query.andWhere("m.id", matchId);
//     }

//     const getStatusFilter = (type) => {
//       switch (type.toLowerCase()) {
//         case "started":
//         case "live":
//           return [
//             "1st Innings",
//             "2nd Innings",
//             "3rd Innings",
//             "4th Innings",
//             "Stump Day 1",
//             "Stump Day 2", 
//             "Stump Day 3",
//             "Stump Day 4",
//             "Innings Break",
//             "Tea Break",
//             "Lunch",
//             "Tea Break",
//             "Dinner",
//             "Live",
//             "Int.",
//           ];
//         case "finished":
//         case "completed":
//           return ["Finished", "Completed", "Cancl", "Cancl.", "Cancelled"];
//         case "ns":
//         case "notstarted":
//           return [
//             "NS",
//             "Not Started",
//             "Not started",
//             "Delayed",
//             "Postp.",
//             "Postponed",
//           ];
//         case "all":
//           return null;
//         default:
//           return [type];
//       }
//     };

//     if (type && type !== "all") {
//       const statusFilter = getStatusFilter(type);
//       if (statusFilter) {
//         query =
//           statusFilter.length === 1
//             ? query.andWhere("m.status", statusFilter[0])
//             : query.whereIn("m.status", statusFilter);
//       }
//     }

//     const matches = await query.orderBy("m.start_time", "desc");
//     const matchIds = matches.map((m) => m.id);

//     if (matchIds.length === 0) {
//       return [];
//     }

//     // 2 Get seasonId mapping for each match
//     const tournaments = await db("tournaments")
//       .select("id", "metadata")
//       .whereIn(
//         "id",
//         matches.map((m) => m.tournament_id)
//       );

//     const seasonIdsByMatch = new Map();
//     for (const match of matches) {
//       const tournament = tournaments.find(
//         (t) => t.id === match.tournament_id
//       );
//       let seasonId = null;

//       if (tournament?.metadata) {
//         const metadata =
//           typeof tournament.metadata === "string"
//             ? JSON.parse(tournament.metadata)
//             : tournament.metadata;
//         seasonId = metadata.season_id;
//       }
//       seasonIdsByMatch.set(match.id, seasonId);
//     }

//     // Get notifications
//     const notifications = await db("notifications")
//       .whereIn("match_id", matchIds)
//       .andWhere({ user_id: userId, status: true });
//     const notificationsMap = new Map(
//       notifications.map((n) => [n.match_id, true])
//     );

//     // Contest count per match
//     const contestCounts = await db("contests")
//       .select("match_id")
//       .count("id as contest_count")
//       .whereIn("match_id", matchIds)
//       .groupBy("match_id");
//     const contestCountMap = new Map(
//       contestCounts.map((c) => [c.match_id, parseInt(c.contest_count)])
//     );

//     // User's teams count per match
//     const userTeamsCounts = await db("fantasy_games as fg")
//       .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
//       .select("ft.match_id")
//       .count("fg.id as teams_count")
//       .where("fg.user_id", userId)
//       .whereIn("ft.match_id", matchIds)
//       .groupBy("ft.match_id");
//     const userTeamsCountMap = new Map(
//       userTeamsCounts.map((t) => [t.match_id, parseInt(t.teams_count)])
//     );

//     // Get ONLY user's contest entries (without stored rank)
//     const contestEntries = await db("fantasy_games as fg")
//       .join("contests as c", "fg.contest_id", "c.id")
//       .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
//       .leftJoin("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
//       .join("users as u", "fg.user_id", "u.id")
//       .select(
//         "c.match_id",
//         "c.id as contest_id",
//         "c.filled_spots",
//         "fg.team_name_user",
//         "fg.fantasy_team_id",
//         "ft.name as fantasy_team_name",
//         "ft.total_points as fantasy_team_points",
//         "ft.status as team_status",
//         db.raw('COALESCE(lb."totalScore", NULL) as total_points'),
//         "u.name as username",
//         "u.image_url as profile_image"
//       )
//       .where("fg.user_id", userId)
//       .whereIn("c.match_id", matchIds);

//     // Get ALL contest entries for leaderboard calculation (all users)
//     const allContestEntries = await db("fantasy_games as fg")
//       .join("contests as c", "fg.contest_id", "c.id")
//       .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
//       .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
//       .join("users as u", "fg.user_id", "u.id")
//       .select(
//         "c.match_id",
//         "c.id as contest_id",
//         "fg.fantasy_team_id",
//         "ft.name as fantasy_team_name",
//         "fg.team_name_user as team_label",
//         db.raw('COALESCE(lb."totalScore", 0) as totalScore'),
//         "u.name as username",
//         "u.image_url as profile_image"
//       )
//       .whereIn("c.match_id", matchIds);

//     // Group user's contest entries by match
//     const contestsByMatchId = new Map();
//     const usedTeamsByMatchId = new Map();

//     for (const row of contestEntries) {
//       if (!contestsByMatchId.has(row.match_id)) {
//         contestsByMatchId.set(row.match_id, []);
//       }
//       contestsByMatchId.get(row.match_id).push({
//         contest_id: row.contest_id,
//         team_label: row.team_name_user,
//         fantasy_team_id: row.fantasy_team_id,
//         fantasy_team_name: row.fantasy_team_name,
//         points:  Number(row.total_points),
//         filled_spots: row.filled_spots ? Number(row.filled_spots) : 0,
//         username: row.username,
//         profile_image: row.profile_image
//           ? `${config.baseURL}/${row.profile_image}`
//           : null,
//       });

//       // Track only teams used in contests
//       if (!usedTeamsByMatchId.has(row.match_id)) {
//         usedTeamsByMatchId.set(row.match_id, new Map());
//       }
//       const teamKey = row.fantasy_team_id;
//       if (!usedTeamsByMatchId.get(row.match_id).has(teamKey)) {
//         usedTeamsByMatchId.get(row.match_id).set(teamKey, {
//           id: row.fantasy_team_id,
//           name: row.fantasy_team_name,
//           label: row.team_name_user,
//           total_points: row.fantasy_team_points ?? 0,
//           team_status: row.team_status ?? 0,
//         });
//       }
//     }

//     // Build players for only used teams
//     const allUsedTeamIds = Array.from(usedTeamsByMatchId.values())
//       .flat()
//       .map((t) => Array.from(t.values()))
//       .flat()
//       .map((t) => t.id);

//     // Include ALL contest participants' fantasy teams (not just current user's)
//     const allContestTeamIds = Array.from(
//       new Set((allContestEntries || []).map((e) => e.fantasy_team_id))
//     );
//     const combinedTeamIds = Array.from(
//       new Set([...allUsedTeamIds, ...allContestTeamIds])
//     );

//     let playersByTeamId = {};
//     if (combinedTeamIds.length > 0) {
//       const whenClauses = [];
//       const whenParams = [];

//       for (const [matchId, seasonId] of seasonIdsByMatch.entries()) {
//         if (seasonId) {
//           whenClauses.push("WHEN m.id = ? THEN ?");
//           whenParams.push(matchId, seasonId);
//         }
//       }

//       const caseExpr = whenClauses.length
//         ? `pt.season_id = (CASE ${whenClauses.join(
//             " "
//           )} ELSE pt.season_id END)`
//         : "1=1";

//       const seenKeys = new Set();

//       const teamPlayersRows = await db("fantasy_team_players as ftp")
//         .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
//         .join("matches as m", "ft.match_id", "m.id")
//         .leftJoin("match_players as mp", function () {
//           this.on("mp.match_id", "m.id").andOn(
//             "mp.player_id",
//             "ftp.player_id"
//           );
//         })
//         .join("players as p", "ftp.player_id", "p.id")
//         .leftJoin("player_teams as pt", function () {
//           this.on("pt.player_id", "p.id")
//             .andOn(function () {
//               this.on("pt.team_id", "=", "m.team1_id").orOn(
//                 "pt.team_id",
//                 "m.team2_id"
//               );
//             })
//             .andOn(db.raw(caseExpr, whenParams));
//         })
//         .leftJoin("teams as t", "pt.team_id", "t.id")
//         .select(
//           "ftp.fantasy_team_id",
//           "ftp.player_id",
//           db.raw("BOOL_OR(ftp.is_captain) as is_captain"),
//           db.raw("BOOL_OR(ftp.is_vice_captain) as is_vice_captain"),
//           db.raw("BOOL_OR(ftp.substitute) as substitute"),
//           "m.id as match_id",
//           db.raw("COALESCE(mp.is_playing_xi, false) as is_playing_xi"),
//           db.raw("COALESCE(mp.is_substitute, false) as is_substitute"),
//           db.raw(
//             "COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup"
//           ),
//           "ftp.points",
//           "p.name as player_name",
//           "p.role as player_role",
//           "p.credits as player_credits",
//           "t.id as player_team_id",
//           "t.name as player_team_name",
//           "t.short_name as player_team_short_name",
//           db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
//         )
//         .whereIn("ftp.fantasy_team_id", combinedTeamIds)
//         .groupBy(
//           "ftp.fantasy_team_id",
//           "ftp.player_id",
//           "ftp.points",
//           "t.id",
//           "mp.id",
//           "p.id",
//           "m.id"
//         );

//       playersByTeamId = teamPlayersRows.reduce((acc, row) => {
//         const dedupKey = `${row.fantasy_team_id}:${row.player_id}`;
//         if (seenKeys.has(dedupKey)) return acc;
//         seenKeys.add(dedupKey);
//         if (!acc[row.fantasy_team_id]) acc[row.fantasy_team_id] = [];
//         acc[row.fantasy_team_id].push({
//           id: row.player_id,
//           player_id: row.player_id,
//           name: row.player_name,
//           role: row.player_role,
//           credits: row.player_credits,
//           is_captain: row.is_captain,
//           is_vice_captain: row.is_vice_captain,
//           substitute: row.substitute,
//           teamId: row.player_team_id,
//           team_short_name: row.player_team_short_name,
//           team: row.player_team_name,
//           imagePath: row.image_path,
//           fantasy_point: Number(row.points) || 0,
//           captain_percentage: "0.00",
//           vice_captain_percentage: "0.00",
//           in_lineup: row.in_lineup,
//           is_playing_xi: row.is_playing_xi,
//           is_substitute: row.is_substitute,
//         });
//         return acc;
//       }, {});

//       // Compute live team totals from player points with captain/vice multipliers
//       var teamTotals = {};
//       Object.entries(playersByTeamId).forEach(([teamId, players]) => {
//         let total = 0;
//         for (const p of players) {
//           let mult = 1;
//           if (p.is_captain) mult = 2;
//           else if (p.is_vice_captain) mult = 1.5;
//           total += (Number(p.fantasy_point) || 0) * mult;
//         }
//         teamTotals[teamId] = Number(total.toFixed(2));
//       });
//     }

//     // Final response with fixed ranking logic
//     const matchesWithNotification = matches.map((match) => {
//       const time_ago = moment(match.start_time).fromNow();
//       const is_match_live = [
//         "1st Innings",
//         "2nd Innings", 
//         "3rd Innings",
//         "Live",
//       ].includes(match.status);
      
//       let toss = null;
//       let toss_team_name = null;
//       let elected = null;
//       const metadata =
//         typeof match.metadata === "string"
//           ? JSON.parse(match.metadata)
//           : match.metadata;

//       if (metadata && metadata.toss_won_team_id && metadata.elected) {
//         // Map SportMonks team IDs to database team IDs
//         const tossSportMonksId = metadata.toss_won_team_id;

//         if (tossSportMonksId === metadata.localteam_id) {
//           toss_team_name = match.team1_name;
//         } else if (tossSportMonksId === metadata.visitorteam_id) {
//           toss_team_name = match.team2_name;
//         } else {
//           // Fallback: Use team names based on common SportMonks ID mapping
//           toss_team_name =
//             tossSportMonksId === 98
//               ? match.team1_name
//               : tossSportMonksId === 99
//               ? match.team2_name
//               : "Unknown Team";
//         }

//         elected = metadata.elected;
//         toss = `${toss_team_name} won the toss and elected to ${elected}`;
//       }

//       let result_note = null;
//       let winner_team = null;
//       if (["Finished", "Completed"].includes(match.status)) {
//         const metadata =
//           typeof match.metadata === "string"
//             ? JSON.parse(match.metadata)
//             : match.metadata;
//         const scorecard =
//           typeof match.scorecard === "string"
//             ? JSON.parse(match.scorecard)
//             : match.scorecard;
//         const victoryTeamId =
//           match.victory_team_id ||
//           metadata?.winner_team_id ||
//           scorecard?.winner_team_id;

//         result_note = metadata?.note || scorecard?.note || null;

//         if (victoryTeamId) {
//           if (victoryTeamId == match.team1_id) {
//             winner_team = {
//               id: match.team1_id,
//               name: match.team1_name,
//               short_name: match.team1_short_name,
//               logo_url: match.team1_logo_url,
//             };
//           } else if (victoryTeamId == match.team2_id) {
//             winner_team = {
//               id: match.team2_id,
//               name: match.team2_name,
//               short_name: match.team2_short_name,
//               logo_url: match.team2_logo_url,
//             };
//           }
//         }
//       }

//       const isFinished = ["Finished", "Completed"].includes(match.status);

//       const isLiveOrStarted = [
//         "1st Innings",
//         "2nd Innings",
//         "3rd Innings",
//         "Live",
//       ].includes(match.status);

//       // For both finished and live/started, include contest and teams arrays
//       const shouldIncludeContestTeams = isFinished || isLiveOrStarted;

//       return {
//         ...match,
//         time_ago,
//         is_match_live,
//         total_contest: contestCountMap.get(match.id) || 0,
//         total_teams: userTeamsCountMap.get(match.id) || 0,
//         is_match_notification: !!notificationsMap.get(match.id),
//         toss, // Add formatted toss information
//         toss_team_name, // Add toss team name separately
//         elected, //
//         result_note,
//         winner_team,
//         contets: shouldIncludeContestTeams
//           ? {
//               total: (contestsByMatchId.get(match.id) || []).length,
//               list: (contestsByMatchId.get(match.id) || []).map((contest) => {
//                 const allEntriesInContest = (allContestEntries || []).filter(
//                   (c) => c.contest_id === contest.contest_id
//                 );


//                 const leaderboard = allEntriesInContest
//                   .sort((a, b) => b.totalscore - a.totalscore)
//                   .map((c, index) => ({
//                     fantasy_team_id: c.fantasy_team_id,
//                     team_label: c.team_label,
//                     fantasy_team_name: c.fantasy_team_name,
//                     rank: index + 1,
//                     points: Number(c.totalscore),
//                     username: c.username,
//                     profile_image: c.profile_image
//                       ? `${config.baseURL}/${c.profile_image}`
//                       : null,
//                   }));

//                 // Find current user's team rank from the dynamically built leaderboard
//                 const myTeamRank =
//                   leaderboard.find(
//                     (l) => l.fantasy_team_id === contest.fantasy_team_id
//                   )?.rank || null;

//                 return {
//                   contest_id: contest.contest_id,
//                   team_label: contest.team_label,
//                   fantasy_team_id: contest.fantasy_team_id,
//                   fantasy_team_name: contest.fantasy_team_name,
//                   points: contest.points,
//                   filled_spots: contest.filled_spots,
//                   username: contest.username,
//                   profile_image: contest.profile_image,
//                   rank: myTeamRank,
//                   leaderboard,
//                 };
//               }),
//               total_participants: (() => {
//                 // Calculate total participants across all contests for this match
//                 const contests = contestsByMatchId.get(match.id) || [];
//                 const uniqueContestIds = new Set();
//                 let totalParticipants = 0;
//                 for (const contest of contests) {
//                   if (
//                     contest.contest_id &&
//                     !uniqueContestIds.has(contest.contest_id)
//                   ) {
//                     uniqueContestIds.add(contest.contest_id);
//                     totalParticipants += contest.filled_spots || 0;
//                   }
//                 }
//                 return totalParticipants;
//               })(),
//             }
//           : undefined,
//         teams: shouldIncludeContestTeams
//           ? Array.from(usedTeamsByMatchId.get(match.id) || []).map(
//               ([_, team]) => ({
//                 backup_players: [],
//                 fantasy_team_id: team.id,
//                 fantasy_team_name: team.name,
//                 match_id: match.id,
//                 players: playersByTeamId[team.id] || [],
//                 team1_id: match.team1_id,
//                 team1_image: match.team1_logo_url,
//                 team1_player_count: (playersByTeamId[team.id] || []).filter(
//                   (p) => p.teamId === match.team1_id && !p.substitute
//                 ).length,
//                 team1_short_name: match.team1_short_name,
//                 team2_id: match.team2_id,
//                 team2_image: match.team2_logo_url,
//                 team2_player_count: (playersByTeamId[team.id] || []).filter(
//                   (p) => p.teamId === match.team2_id && !p.substitute
//                 ).length,
//                 team2_short_name: match.team2_short_name,
//                 team_status: team.team_status,
//                 total_points: team.total_points,
//               })
//             )
//           : undefined,
//       };
//     });

//     return matchesWithNotification;
//   } catch (error) {
//     console.error("getUserMatches error:", error);
//     return [];
//   }
// }

async function getUserMatches(userId, type = "all", matchId = null) {
  try {
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

    if (matchId) {
      query = query.andWhere("m.id", matchId);
    }

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
      return [];
    }
    const requestId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[DEBUG] getUserMatches request: ${requestId}, user: ${userId}, matches: ${matchIds.length}`);

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
        db.raw('COALESCE(lb."totalScore", 0) as totalScore'),
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
        points:  Number(row.total_points),
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

      // Compute live team totals from player points with captain/vice multipliers
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
        // Map SportMonks team IDs to database team IDs
        const tossSportMonksId = metadata.toss_won_team_id;

        if (tossSportMonksId === metadata.localteam_id) {
          toss_team_name = match.team1_name;
        } else if (tossSportMonksId === metadata.visitorteam_id) {
          toss_team_name = match.team2_name;
        } else {
          // Fallback: Use team names based on common SportMonks ID mapping
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
      let scorecard =
        typeof match.scorecard === "string" ? JSON.parse(match.scorecard) : match.scorecard;

      // Assign toss to scorecard.note if scorecard.note is null or empty
      if (!scorecard?.note) {
        if (scorecard) {
          scorecard.note = toss;
        }
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

          result_note = meta?.note || score?.note || toss;


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
          else {
            result_note = scorecard?.note || toss;
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
        scorecard,
        time_ago,
        is_match_live,
        total_contest: contestCountMap.get(match.id) || 0,
        total_teams: userTeamsCountMap.get(match.id) || 0,
        is_match_notification: !!notificationsMap.get(match.id),
        toss, // Add formatted toss information
        toss_team_name, // Add toss team name separately
        elected, //
        result_note: result_note || toss,
        winner_team,
        contets: shouldIncludeContestTeams
          ? {
              total: (contestsByMatchId.get(match.id) || []).length,
              list: (contestsByMatchId.get(match.id) || []).map((contest) => {
                const allEntriesInContest = (allContestEntries || []).filter(
                  (c) => c.contest_id === contest.contest_id
                );

                // Calculate total points for each team with captain/vice-captain multipliers
                const leaderboardWithCalculatedPoints = allEntriesInContest
                  .map((c) => {
                    let calculatedPoints = 0;
                    const players = playersByTeamId[c.fantasy_team_id] || [];
                    
                    // Calculate total points with multipliers
                    for (const player of players) {
                      let multiplier = 1;
                      if (player.is_captain) multiplier = 2;
                      else if (player.is_vice_captain) multiplier = 1.5;
                      
                      calculatedPoints += (Number(player.fantasy_point) || 0) * multiplier;
                    }
                    
                    return {
                      ...c,
                      calculatedPoints: Number(calculatedPoints.toFixed(2))
                    };
                  })
                  .sort((a, b) => b.calculatedPoints - a.calculatedPoints)
                  .map((c, index) => {
                    let playersArr = [];
                    // Include players for both live and finished matches
                    if ((isLiveOrStarted || isFinished) && playersByTeamId && playersByTeamId[c.fantasy_team_id]) {
                      playersArr = playersByTeamId[c.fantasy_team_id].map(player => ({
                        ...player,
                        // Apply captain/vice-captain multipliers to individual player points for display
                        calculated_fantasy_point: Number(
                          (player.fantasy_point * 
                           (player.is_captain ? 2 : player.is_vice_captain ? 1.5 : 1)
                          ).toFixed(2)
                        )
                      }));
                    }
                    
                    return {
                      fantasy_team_id: c.fantasy_team_id,
                      team_label: c.team_label,
                      fantasy_team_name: c.fantasy_team_name,
                      rank: index + 1,
                      points: c.calculatedPoints, // Use calculated points instead of stored totalScore
                      username: c.username,
                      profile_image: c.profile_image
                        ? `${config.baseURL}/${c.profile_image}`
                        : null,
                      // Include players for both live and finished matches
                      ...(isLiveOrStarted || isFinished ? { players: playersArr } : {}),
                    };
                  });

                // Find current user's team rank from the dynamically built leaderboard
                const myTeamRank =
                  leaderboardWithCalculatedPoints.find(
                    (l) => l.fantasy_team_id === contest.fantasy_team_id
                  )?.rank || null;

                return {
                  contest_id: contest.contest_id,
                  team_label: contest.team_label,
                  fantasy_team_id: contest.fantasy_team_id,
                  fantasy_team_name: contest.fantasy_team_name,
                  points: leaderboardWithCalculatedPoints.find(
                    (l) => l.fantasy_team_id === contest.fantasy_team_id
                  )?.points || 0, // Use calculated points
                  filled_spots: contest.filled_spots,
                  username: contest.username,
                  profile_image: contest.profile_image,
                  rank: myTeamRank,
                  leaderboard: leaderboardWithCalculatedPoints,
                };
              }),
              total_participants: (() => {
                // Calculate total participants across all contests for this match
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
                // Calculate total points with multipliers for the team display
                let totalPoints = 0;
                for (const player of players) {
                  let multiplier = 1;
                  if (player.is_captain) multiplier = 2;
                  else if (player.is_vice_captain) multiplier = 1.5;
                  
                  totalPoints += (Number(player.fantasy_point) || 0) * multiplier;
                }
                
                return {
                  backup_players: [],
                  fantasy_team_id: team.id,
                  fantasy_team_name: team.name,
                  match_id: match.id,
                  players: players.map(player => ({
                    ...player,
                    // Apply multipliers for individual display
                    calculated_fantasy_point: Number(
                      (player.fantasy_point * 
                       (player.is_captain ? 2 : player.is_vice_captain ? 1.5 : 1)
                      ).toFixed(2)
                    )
                  })),
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

    return matchesWithNotification;
  } catch (error) {
    console.error("getUserMatches error:", error);
    return [];
  }
}

module.exports = { getUserMatches };

