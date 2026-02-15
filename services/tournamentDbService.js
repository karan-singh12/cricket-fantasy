const { downloadAndSaveImage } = require("../utils/functions");
// insert tournaments service......
const insertTournaments = async (data, db) => {
  // {
  //   "resource": "leagues",
  //   "id": 441,
  //   "season_id": 1756,
  //   "country_id": 153732,
  //   "name": "Andhra Premier League",
  //   "code": "APL",
  //   "image_path": "https://cdn.sportmonks.com/images/cricket/leagues/25/441.png",
  //   "type": "league",
  //   "updated_at": "2025-07-29T18:28:47.000000Z",
  //   "season": {
  //     "resource": "seasons",
  //     "id": 1756,
  //     "league_id": 441,
  //     "name": "2025",
  //     "code": "2025",
  //     "updated_at": "2025-07-29T18:27:52.000000Z"
  //   }
  // },
  try {
    for (let league of data) {
      const tournamentData = {
        name: league.name,
        tournament_id: String(league.id),
        season: league.season ? league.season.id : null,
        start_date: null,
        end_date: null,
        status: 1,
        category: league.type || null,
        metadata: JSON.stringify(league),
        updated_at: new Date(),
      };

      const existingTournament = await db("tournaments")
        .where({ tournament_id: String(league.id) })
        .first();

      if (!existingTournament) {
        tournamentData.created_at = new Date();
        await db("tournaments").insert(tournamentData);
        console.log(`Inserted new tournament ${league.id}`);
      } else {
        await db("tournaments")
          .where({ tournament_id: String(league.id) })
          .update(tournamentData);
        console.log(`Updated existing tournament ${league.id}`);
      }
    }
  } catch (error) {
    console.error("Error inserting or updating tournaments: ", error.message);
  }
};

// insert team by fetching seasonid (Tid).......
const insertTeams = async (seasonData, db, tournamentId) => {
  try {
    const teams = seasonData.teams;
    const leagueId = seasonData.league_id; // tournamentId

    if (!Array.isArray(teams)) {
      throw new Error("Invalid or missing teams array in response.");
    }
    const result = [];

    for (const team of teams) {
      const existingTeam = await db("teams")
        .where({ team_id: team.id })
        .first();

      const teamData = {
        name: team.name,
        team_id: team.id,
        short_name: team.code,
        logo_url: team.image_path,
        country: String(team.country_id),
        tournament_id: tournamentId,
        sm_league_id: leagueId,
        metadata: JSON.stringify(team),
        updated_at: new Date(),
      };

      if (!existingTeam) {
        teamData.created_at = new Date();
        await db("teams").insert(teamData);

        result.push({ action: "inserted", team_id: team.id });
      } else {
        await db("teams").where({ team_id: team.id }).update(teamData);

        result.push({ action: "updated", team_id: team.id });
      }
    }
    return result;
  } catch (error) {
    console.error("Error inserting/updating teams: ", error.message);
    throw error;
  }
};
// insert fixetures (matches) in match table......
const insertFixtures = async (seasonData, db, tournamentId) => {
  try {
    const result = [];
    const fixtures = seasonData.fixtures;

    if (!Array.isArray(fixtures)) {
      throw new Error("Invalid or missing fixtures array in response.");
    }

    for (const fixture of fixtures) {
      const localTeam = await db("teams")
        .where({ team_id: fixture.localteam_id })
        .first();

      const visitorTeam = await db("teams")
        .where({ team_id: fixture.visitorteam_id })
        .first();

      if (!localTeam || !visitorTeam) {
        console.warn(
          `Team not found in DB for fixture ${fixture.id}. Skipping.`
        );
        continue;
      }

      const matchData = {
        tournament_id: tournamentId,
        sm_match_id: fixture.id,
        team1_id: localTeam.id,
        team2_id: visitorTeam.id,
        victory_team_id: fixture.winner_team_id
          ? (await db("teams").where("team_id", fixture.winner_team_id).first())
            ?.id || null
          : null,
        venue: fixture.venue_id ? String(fixture.venue_id) : null,
        match_number: fixture.round,
        match_type: fixture.type,
        start_time: fixture.starting_at
          ? new Date(fixture.starting_at).toISOString()
          : null,
        status: fixture.status,
        toss: fixture.elected ? fixture.elected : null,
        man_of_match: fixture.man_of_match_id
          ? String(fixture.man_of_match_id)
          : null,
        referee: fixture.referee_id ? String(fixture.referee_id) : null,
        scorecard: JSON.stringify({
          localteam_dl_data: fixture.localteam_dl_data,
          visitorteam_dl_data: fixture.visitorteam_dl_data,
          note: fixture.note,
        }),
        metadata: JSON.stringify(fixture),
        updated_at: new Date(),
      };

      const existingMatch = await db("matches")
        .where({ sm_match_id: fixture.id })
        .first();

      if (!existingMatch) {
        matchData.created_at = new Date();
        await db("matches").insert(matchData);
        console.log(`Inserted Match: ${fixture.id}`);
        result.push({
          action: "inserted",
          match_id: fixture.id,
          status: fixture.status,
        });
      } else {
        // Preserve enriched scorecard written by insertMatchStats; don't overwrite during updates
        const { scorecard, ...updateData } = matchData;
        await db("matches")
          .where({ sm_match_id: fixture.id })
          .update(updateData);
        console.log(`Updated Match: ${fixture.id}`);
        result.push({
          action: "updated",
          match_id: fixture.id,
          status: fixture.status,
        });
      }
    }
    return result;
  } catch (error) {
    console.error("Error inserting/updating matches:", error.message);
    throw error;
  }
};
//  inserty players in players table and player_teams table.......
const insertTeamSquad = async (teamData, db, teamDbId, teamSmId, seasonId) => {
  console.log("insertTeamSquad params", teamData, teamDbId, teamSmId, seasonId);
  try {
    const squad = teamData.squad;

    if (!Array.isArray(squad)) {
      throw new Error("Invalid or missing squad array in response.");
    }

    const result = [];

    for (const player of squad) {
      let existingPlayer = await db("players")
        .where({ player_id: player.id })
        .first();

      const playerData = {
        name: player.fullname,
        player_id: player.id,
        role: player.position?.name || null,
        batting_style: player.battingstyle || null,
        bowling_style: player.bowlingstyle || null,
        date_of_birth: player.dateofbirth || null,
        nationality: String(player.country_id),
        image_path: player.image_path,
        metadata: JSON.stringify(player),
        updated_at: new Date(),
      };

      let playerDbId;

      if (!existingPlayer) {
        // Insert if not exists
        playerData.created_at = new Date();
        const [insertedId] = await db("players")
          .insert(playerData)
          .returning("id");
        playerDbId = insertedId?.id || insertedId;
        console.log(`Inserted player: ${player.fullname}`);
        result.push({ action: "inserted", player_id: player.id });
      } else {
        // Update if exists
        await db("players").where({ player_id: player.id }).update(playerData);
        playerDbId = existingPlayer.id;
        console.log(`Updated player: ${player.fullname}`);
        result.push({ action: "updated", player_id: player.id });
      }

      const existingSmRelation = await db("player_teams")
        .where({
          player_id: playerDbId,
          team_id: teamDbId,
          season_id: seasonId,
        })
        .first();
      if (!existingSmRelation) {
        await db("player_teams").insert({
          player_id: playerDbId,
          team_id: teamDbId,
          sm_player_id: Number(player.id),
          sm_team_id: String(teamSmId),
          created_at: new Date(),

          season_id: seasonId,
          updated_at: new Date(),
        });
        console.log(
          `Linked player ${player.fullname} with team ID ${teamDbId}`
        );
      } else {
        console.log(
          `Player ${player.fullname} already linked with sm_team_id ${teamData.id}`
        );
      }
    }
    return result;
  } catch (error) {
    console.error(
      "Error inserting/updating players and player_teams:",
      error.message
    );
  }
};

const insertPlayerCareer = async (seasonData, db) => {
  try {
  } catch (error) {
    console.error("Error inserting/updating fixtures: ", error.message);
  }
};

const insertStages = async (stages, db, tournamentId) => {
  try {
    if (!Array.isArray(stages)) {
      throw new Error("Invalid or missing stages array in response.");
    }

    const results = [];

    for (const stage of stages) {
      const existingStage = await db("season_stages")
        .where({ sm_stage_id: String(stage.id) })
        .first();

      const stageData = {
        tournament_id: tournamentId,
        sm_stage_id: stage.id ? Number(stage.id) : null,
        sm_season_id: stage.season_id ? Number(stage.season_id) : null,
        sm_league_id: stage.league_id ? Number(stage.league_id) : null,
        name: stage.name || null,
        code: stage.code || null,
        type: stage.type || null,
        standings: stage.standings || null,
        updated_at: new Date(),
      };

      if (!existingStage) {
        // Insert if not exists
        stageData.created_at = new Date();
        const [id] = await db("season_stages")
          .insert(stageData)
          .returning("id");
        results.push({ id, action: "inserted", name: stage.name });
        console.log(`Inserted stage: ${stage.name}`);
      } else {
        // Update if exists
        await db("season_stages")
          .where({ sm_stage_id: String(stage.id) })
          .update(stageData);
        results.push({
          id: existingStage.id,
          action: "updated",
          name: stage.name,
        });
        console.log(`Updated stage: ${stage.name}`);
      }
    }

    return results;
  } catch (error) {
    console.error("Error inserting/updating stages: ", error.message);
    throw error;
  }
};

const insertVenues = async (venues, db) => {
  try {
    if (!Array.isArray(venues)) {
      throw new Error("Invalid or missing venues array in response.");
    }

    const results = [];

    for (const venue of venues) {
      const existingVenue = await db("venues")
        .where({ venue_id: venue.id })
        .first();

      const venueData = {
        venue_id: venue.id || null,
        country_id: venue.country_id || null,
        name: venue.name || null,
        city: venue.city || null,
        image_path: venue.image_path || null,
        capacity: venue.capacity || null,
        floodlight:
          venue.floodlight !== undefined ? Boolean(venue.floodlight) : null,
        updated_at: venue.updated_at ? new Date(venue.updated_at) : new Date(),
      };

      if (!existingVenue) {
        const [id] = await db("venues").insert(venueData).returning("id");

        results.push({ id, action: "inserted", name: venue.name });
        console.log(`Inserted venue: ${venue.name}`);
      } else {
        await db("venues").where({ venue_id: venue.id }).update(venueData);

        results.push({
          id: existingVenue.id,
          action: "updated",
          name: venue.name,
        });
        console.log(`Updated venue: ${venue.name}`);
      }
    }

    return results;
  } catch (error) {
    console.error("Error inserting/updating venues: ", error.message);
    throw error;
  }
};

const insertCountries = async (countries, db) => {
  try {
    if (!Array.isArray(countries)) {
      throw new Error("Invalid or missing countries array in response.");
    }

    const results = [];

    for (const country of countries) {
      const existingCountry = await db("countries")
        .where({ country_id: country.id })
        .first();

      const countryData = {
        country_id: country.id || null,
        continent_id: country.continent_id || null,
        name: country.name || null,
        image_path: country.image_path || null,
        updated_at: country.updated_at ? new Date(country.updated_at) : null,
      };

      if (!existingCountry) {
        const [id] = await db("countries").insert(countryData).returning("id");

        results.push({ id, action: "inserted", name: country.name });
        console.log(`Inserted country: ${country.name}`);
      } else {
        await db("countries")
          .where({ country_id: country.id })
          .update(countryData);

        results.push({
          id: existingCountry.id,
          action: "updated",
          name: country.name,
        });
        console.log(`Updated country: ${country.name}`);
      }
    }

    return results;
  } catch (error) {
    console.error("Error inserting/updating countries: ", error.message);
    throw error;
  }
};

const insertFantasyPoints = async (scores, db) => {
  try {
    if (!Array.isArray(scores)) {
      throw new Error("Invalid or missing scores array.");
    }

    const results = [];

    for (const score of scores) {
      const scoreData = {
        action: score.name,
        // Keep DB 'points' neutral by default; actual per-ball points are interpreted in scoreCalculation
        points: 2,
        description: score.name,
        conditions: null,
        score_id: score.id,
        runs: score.runs,
        four: score.four,
        six: score.six,
        bye: score.bye,
        leg_bye: score.leg_bye,
        noball: score.noball,
        noball_runs: score.noball_runs,
        is_wicket: score.is_wicket,
        ball: score.ball,
        out: score.out,
      };

      // Check if entry exists by score_id (adjust logic if needed)
      let existing = null;
      if (scoreData.score_id !== null) {
        existing = await db("fantasy_points")
          .where({ score_id: scoreData.score_id })
          .first();
      } else {
        // Fallback to action as alternate identifier if score_id not present
        existing = await db("fantasy_points")
          .where({ action: scoreData.action })
          .first();
      }

      if (!existing) {
        // Insert new scoring rule
        const [id] = await db("fantasy_points")
          .insert(scoreData)
          .returning("id");
        results.push({ id, action: "inserted", action_name: scoreData.action });
        console.log(`Inserted fantasy point: ${scoreData.action}`);
      } else {
        // Update existing record
        await db("fantasy_points")
          .where({ id: existing.id })
          .update({ ...scoreData, updated_at: new Date() });
        results.push({
          id: existing.id,
          action: "updated",
          action_name: scoreData.action,
        });
        console.log(`Updated fantasy point: ${scoreData.action}`);
      }
    }

    return results;
  } catch (error) {
    console.error("Error inserting/updating fantasy points: ", error.message);
    throw error;
  }
};

// const insertMatchStats = async (matchResponse, db) => {
//   try {
//     // 1. Get our DB match id using the external id
//     const matchRow = await db("matches")
//       .where({ sm_match_id: matchResponse.id })
//       .first();
//     if (!matchRow)
//       throw new Error(
//         `Match not found in DB for sm_match_id: ${matchResponse.id}`
//       );

//     const matchId = matchRow.id; // our real match id

//     await db("matches")
//       .where({ id: matchId })
//       .update({
//         status: matchResponse.status,
//         ...(typeof matchResponse.status === "string" &&
//         matchResponse.status.toLowerCase() === "finished"
//           ? { end_time: new Date() }
//           : {}),
//         updated_at: new Date(),
//       });

//     // 1.a Update scorecard summary from scoreboards (works even if no balls provided)
//     try {
//       const scoreboards = Array.isArray(matchResponse.scoreboards)
//         ? matchResponse.scoreboards
//         : [];

//       if (scoreboards.length) {
//         // Build map of SM team_id -> summary for totals and extras
//         const totalsBySmTeamId = {};
//         const extrasBySmTeamId = {};
//         for (const sb of scoreboards) {
//           if (sb && sb.type === "total") {
//             totalsBySmTeamId[String(sb.team_id)] = {
//               total: sb.total ?? 0,
//               overs: sb.overs ?? 0,
//               wickets: sb.wickets ?? 0,
//               scoreboard: sb.scoreboard ?? null,
//             };
//           } else if (sb && sb.type === "extra") {
//             extrasBySmTeamId[String(sb.team_id)] = {
//               wide: sb.wide ?? 0,
//               noball_runs: sb.noball_runs ?? 0,
//               noball_balls: sb.noball_balls ?? 0,
//               bye: sb.bye ?? 0,
//               leg_bye: sb.leg_bye ?? 0,
//               penalty: sb.penalty ?? 0,
//               scoreboard: sb.scoreboard ?? null,
//             };
//           }
//         }

//         // Resolve SM team ids -> DB ids so we can align with team1 and team2
//         const smTeamIds = Array.from(
//           new Set([
//             ...Object.keys(totalsBySmTeamId),
//             ...Object.keys(extrasBySmTeamId),
//           ])
//         );
//         const teamsMapRows = smTeamIds.length
//           ? await db("teams").whereIn("team_id", smTeamIds)
//           : [];
//         const smToDbTeamMapFromBoards = {};
//         teamsMapRows.forEach((row) => {
//           smToDbTeamMapFromBoards[String(row.team_id)] = row.id;
//         });

//         // Map summaries to team1/team2
//         const team1Summary = {
//           ...((() => {
//             // find SM team id that maps to team1_id
//             const smId = Object.keys(smToDbTeamMapFromBoards).find(
//               (k) => smToDbTeamMapFromBoards[k] === matchRow.team1_id
//             );
//             return smId ? totalsBySmTeamId[smId] : null;
//           })() || {}),
//         };
//         const team1Extras = {
//           ...((() => {
//             const smId = Object.keys(smToDbTeamMapFromBoards).find(
//               (k) => smToDbTeamMapFromBoards[k] === matchRow.team1_id
//             );
//             return smId ? extrasBySmTeamId[smId] : null;
//           })() || {}),
//         };
//         const team2Summary = {
//           ...((() => {
//             const smId = Object.keys(smToDbTeamMapFromBoards).find(
//               (k) => smToDbTeamMapFromBoards[k] === matchRow.team2_id
//             );
//             return smId ? totalsBySmTeamId[smId] : null;
//           })() || {}),
//         };
//         const team2Extras = {
//           ...((() => {
//             const smId = Object.keys(smToDbTeamMapFromBoards).find(
//               (k) => smToDbTeamMapFromBoards[k] === matchRow.team2_id
//             );
//             return smId ? extrasBySmTeamId[smId] : null;
//           })() || {}),
//         };

//         // Find which team is localteam and which is visitorteam
//         const localteamId = matchResponse.localteam_id;
//         const visitorteamId = matchResponse.visitorteam_id;

//         // Find corresponding scoreboards for localteam and visitorteam
//         const localTeamTotal =
//           scoreboards.find(
//             (sb) => sb.team_id === localteamId && sb.type === "total"
//           ) || {};

//         const visitorTeamTotal =
//           scoreboards.find(
//             (sb) => sb.team_id === visitorteamId && sb.type === "total"
//           ) || {};

//         // Create enhanced DL data with actual scores
//         const localteam_dl_data = {
//           score: localTeamTotal.total || null,
//           overs: localTeamTotal.overs || null,
//           wickets_out: localTeamTotal.wickets || null,
//         };

//         const visitorteam_dl_data = {
//           score: visitorTeamTotal.total || null,
//           overs: visitorTeamTotal.overs || null,
//           wickets_out: visitorTeamTotal.wickets || null,
//         };

//         // Compose scorecard payload
//         const scorecardPayload = {
//           note: matchResponse.note ?? null,
//           localteam_dl_data: localteam_dl_data,
//           visitorteam_dl_data: visitorteam_dl_data,
//           summary: {
//             team1: team1Summary,
//             team2: team2Summary,
//           },
//           extras: {
//             team1: team1Extras,
//             team2: team2Extras,
//           },
//           // Store original scoreboards array for reference
//           scoreboards: Array.isArray(matchResponse.scoreboards)
//             ? matchResponse.scoreboards
//             : [],
//           updated_at: new Date().toISOString(),
//         };

//         // Optionally set victory team in DB if present
//         if (matchResponse.winner_team_id) {
//           const winnerDbId =
//             smToDbTeamMapFromBoards[String(matchResponse.winner_team_id)] ||
//             null;
//           if (winnerDbId) {
//             await db("matches")
//               .where({ id: matchId })
//               .update({ victory_team_id: winnerDbId });
//           }
//         }

//         await db("matches")
//           .where({ id: matchId })
//           .update({ scorecard: JSON.stringify(scorecardPayload) });
//       }
//     } catch (sbErr) {
//       console.warn(
//         `[insertMatchStats] Scoreboard update warning for match ${matchResponse.id}:`,
//         sbErr.message || sbErr
//       );
//     }

//     const balls = matchResponse.balls || [];
//     if (!balls.length) {
//       console.log(`No balls data for match ${matchResponse.id}`);
//       // We still updated scoreboard above; return early
//       return [];
//     }

//     // 2. Gather all unique external player ids used in the match
//     const externalPlayerIds = new Set();

//     const externalTeamIds = new Set();
//     for (const ball of balls) {
//       if (ball.batsman_id) externalPlayerIds.add(ball.batsman_id);
//       if (ball.bowler_id) externalPlayerIds.add(ball.bowler_id);
//       if (ball.catchstump_id) externalPlayerIds.add(ball.catchstump_id);
//       if (ball.runout_by_id) externalPlayerIds.add(ball.runout_by_id);
//       if (ball.team_id) externalTeamIds.add(ball.team_id);
//     }
//     // Also include team ids seen in scoreboards to create a complete mapping
//     const sbTeams = Array.isArray(matchResponse.scoreboards)
//       ? matchResponse.scoreboards.map((sb) => sb.team_id).filter(Boolean)
//       : [];
//     sbTeams.forEach((tid) => externalTeamIds.add(tid));

//     // 3. Query our DB to get mapping: sportmonks id -> our player id
//     const players = await db("players").whereIn(
//       "player_id",
//       Array.from(externalPlayerIds)
//     );
//     const smToDbPlayerMap = {};
//     players.forEach((row) => {
//       smToDbPlayerMap[row.player_id] = row.id;
//     });

//     const teams = await db("teams").whereIn(
//       "team_id",
//       Array.from(externalTeamIds)
//     );
//     const smToDbTeamMap = {};
//     teams.forEach((row) => {
//       smToDbTeamMap[row.team_id] = row.id;
//     });

//     const missingTeams = Array.from(externalTeamIds).filter(
//       (id) => !smToDbTeamMap[id]
//     );
//     if (missingTeams.length > 0) {
//       console.warn(
//         `Teams not found in DB for match ${matchResponse.id}:`,
//         missingTeams
//       );
//     }

//     // 4. Aggregate stats using our DB player ids
//     const playerStats = {};

//     for (const ball of balls) {
//       // Get the internal team ID
//       const teamDbId = smToDbTeamMap[ball.team_id];
//       if (!teamDbId) {
//         console.warn(
//           `Team ID ${ball.team_id} not found in DB for match ${matchResponse.id}. Skipping ball.`
//         );
//         continue;
//       }
//       // --- Batting (batsman) ---
//       const batsmanDbId = smToDbPlayerMap[ball.batsman_id];
//       if (!batsmanDbId) {
//         console.warn(
//           `Player ID ${ball.batsman_id} not found in DB for match ${matchResponse.id}. Skipping batting stats.`
//         );
//         continue;
//       }

//       if (!playerStats[batsmanDbId]) {
//         playerStats[batsmanDbId] = defaultStats(matchId, batsmanDbId, teamDbId); // Use teamDbId
//       }
//       const batsmanStats = playerStats[batsmanDbId];

//       batsmanStats.runs += ball.score.runs || 0;
//       batsmanStats.balls_faced += ball.score.ball ? 1 : 0;
//       batsmanStats.fours += ball.score.four ? 1 : 0;
//       batsmanStats.sixes += ball.score.six ? 1 : 0;

//       // Dismissal info
//       if (ball.score.is_wicket && ball.score.out) {
//         batsmanStats.batting_status = "out";
//         batsmanStats.dismissal_type = ball.score.name;
//         batsmanStats.dismissal_bowler = ball.bowler?.fullname || null;
//         if (ball.catchstump_id) {
//           batsmanStats.dismissal_fielders = String(
//             smToDbPlayerMap[ball.catchstump_id] || ball.catchstump_id
//           );
//         } else if (ball.runout_by_id) {
//           batsmanStats.dismissal_fielders = String(
//             smToDbPlayerMap[ball.runout_by_id] || ball.runout_by_id
//           );
//         }
//       } else {
//         batsmanStats.batting_status = batsmanStats.batting_status || "not out";
//       }
//       batsmanStats.metadata.balls = batsmanStats.metadata.balls || [];
//       batsmanStats.metadata.balls.push({ ...ball });

//       // --- Bowling (bowler) ---
//       const bowlerDbId = smToDbPlayerMap[ball.bowler_id];
//       if (bowlerDbId) {
//         if (!playerStats[bowlerDbId]) {
//           playerStats[bowlerDbId] = defaultStats(matchId, bowlerDbId, teamDbId); // Use teamDbId
//         }
//         const bowlerStats = playerStats[bowlerDbId];

//         if (ball.score.ball) {
//           bowlerStats.overs_bowled += 1 / 6;
//           if (ball.score.runs === 0) bowlerStats.dots += 1;
//         }
//         bowlerStats.runs_conceded +=
//           (ball.score.runs || 0) +
//           (ball.score.noball_runs || 0) +
//           (ball.score.bye || 0) +
//           (ball.score.leg_bye || 0) +
//           (ball.score.noball || 0);

//         bowlerStats.wickets += ball.score.is_wicket && ball.score.out ? 1 : 0;
//         bowlerStats.wides += ball.score.noball ? 1 : 0;
//         bowlerStats.no_balls += ball.score.noball ? 1 : 0;

//         bowlerStats.metadata.balls_bowled =
//           bowlerStats.metadata.balls_bowled || [];
//         bowlerStats.metadata.balls_bowled.push({ ...ball });
//       }

//       // --- Fielding (catch/stump/runout) ---
//       // Catches/Stumpings (catchstump_id)
//       if (ball.catchstump_id) {
//         const fielderDbId = smToDbPlayerMap[ball.catchstump_id];
//         if (fielderDbId) {
//           if (!playerStats[fielderDbId]) {
//             playerStats[fielderDbId] = defaultStats(
//               matchId,
//               fielderDbId,
//               teamDbId
//             ); // Use teamDbId
//           }
//           const fielderStats = playerStats[fielderDbId];
//           if (ball.score.name === "Stumped") {
//             fielderStats.stumpings += 1;
//           } else {
//             fielderStats.catches += 1;
//           }
//           fielderStats.metadata.fielding = fielderStats.metadata.fielding || [];
//           fielderStats.metadata.fielding.push({ ...ball });
//         }
//       }
//       // Run outs (runout_by_id)
//       if (ball.runout_by_id) {
//         const fielderDbId = smToDbPlayerMap[ball.runout_by_id];
//         if (fielderDbId) {
//           if (!playerStats[fielderDbId]) {
//             playerStats[fielderDbId] = defaultStats(
//               matchId,
//               fielderDbId,
//               teamDbId
//             ); // Use teamDbId
//           }
//           const fielderStats = playerStats[fielderDbId];
//           fielderStats.run_outs += 1;
//           fielderStats.metadata.fielding = fielderStats.metadata.fielding || [];
//           fielderStats.metadata.fielding.push({ ...ball });
//         }
//       }
//     }

//     // 5. Write stats to DB (upsert)
//     const results = [];
//     for (let [player_id, stats] of Object.entries(playerStats)) {
//       // Derived stats: strike_rate, etc.
//       if (stats.balls_faced > 0) {
//         stats.strike_rate = ((stats.runs / stats.balls_faced) * 100).toFixed(2);
//       }
//       if (stats.overs_bowled > 0) {
//         const overs =
//           Math.floor(stats.overs_bowled) + ((stats.overs_bowled * 6) % 6) / 10;
//         stats.overs_bowled = Number(overs.toFixed(2));
//         stats.economy_rate = (stats.runs_conceded / stats.overs_bowled).toFixed(
//           2
//         );
//       }

//       // Upsert one row per player+match
//       const existing = await db("match_stats")
//         .where({ match_id: matchId, player_id })
//         .first();

//       const insertObj = {
//         match_id: matchId,
//         player_id: Number(player_id), // <-- your db id
//         team_id: stats.team_id,
//         runs: stats.runs,
//         balls_faced: stats.balls_faced,
//         fours: stats.fours,
//         sixes: stats.sixes,
//         strike_rate: stats.strike_rate,
//         dismissal_type: stats.dismissal_type,
//         dismissal_bowler: stats.dismissal_bowler,
//         dismissal_fielders: stats.dismissal_fielders,
//         batting_status: stats.batting_status,
//         overs_bowled: stats.overs_bowled,
//         maidens: stats.maidens,
//         runs_conceded: stats.runs_conceded,
//         wickets: stats.wickets,
//         economy_rate: stats.economy_rate,
//         dots: stats.dots,
//         wides: stats.wides,
//         no_balls: stats.no_balls,
//         catches: stats.catches,
//         run_outs: stats.run_outs,
//         stumpings: stats.stumpings,
//         role: stats.role,
//         metadata: JSON.stringify(stats.metadata),
//         updated_at: new Date(),
//       };

//       if (!existing) {
//         insertObj.created_at = new Date();
//         const [id] = await db("match_stats").insert(insertObj).returning("id");
//         results.push({ player_id, action: "inserted", id });
//       } else {
//         await db("match_stats").where({ id: existing.id }).update(insertObj);
//         results.push({ player_id, action: "updated" });
//       }
//     }
//     return results;
//   } catch (e) {
//     console.error("[insertMatchStats] Error:", e);
//     throw e;
//   }
// };


const insertMatchStats = async (matchResponse, db) => {
  return db.transaction(async (trx) => {
    try {
      // 1. Get our DB match id using the external id
      const matchRow = await trx("matches")
        .where({ sm_match_id: matchResponse.id })
        .first();

      if (!matchRow) {
        throw new Error(`Match not found in DB for sm_match_id: ${matchResponse.id}`);
      }

      const matchId = matchRow.id;

      // 2. Process scoreboard data
      try {
        const scoreboards = Array.isArray(matchResponse.scoreboards) ? matchResponse.scoreboards : [];

        if (scoreboards.length) {
          // Build map of SM team_id -> summary for totals and extras
          const totalsBySmTeamId = {};
          const extrasBySmTeamId = {};

          for (const sb of scoreboards) {
            if (sb && sb.type === "total") {
              totalsBySmTeamId[String(sb.team_id)] = {
                total: sb.total ?? 0,
                overs: sb.overs ?? 0,
                wickets: sb.wickets ?? 0,
                scoreboard: sb.scoreboard ?? null,
              };
            } else if (sb && sb.type === "extra") {
              extrasBySmTeamId[String(sb.team_id)] = {
                wide: sb.wide ?? 0,
                noball_runs: sb.noball_runs ?? 0,
                noball_balls: sb.noball_balls ?? 0,
                bye: sb.bye ?? 0,
                leg_bye: sb.leg_bye ?? 0,
                penalty: sb.penalty ?? 0,
                scoreboard: sb.scoreboard ?? null,
              };
            }
          }

          // Resolve SM team ids -> DB ids so we can align with team1 and team2
          const smTeamIds = Array.from(
            new Set([...Object.keys(totalsBySmTeamId), ...Object.keys(extrasBySmTeamId)])
          );
          const teamsMapRows = smTeamIds.length ? await trx("teams").whereIn("team_id", smTeamIds) : [];

          const smToDbTeamMapFromBoards = {};
          teamsMapRows.forEach((row) => {
            smToDbTeamMapFromBoards[String(row.team_id)] = row.id;
          });

          // Map summaries to team1/team2
          const team1Summary = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team1_id
              );
              return smId ? totalsBySmTeamId[smId] : null;
            })() || {}),
          };

          const team1Extras = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team1_id
              );
              return smId ? extrasBySmTeamId[smId] : null;
            })() || {}),
          };

          const team2Summary = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team2_id
              );
              return smId ? totalsBySmTeamId[smId] : null;
            })() || {}),
          };

          const team2Extras = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team2_id
              );
              return smId ? extrasBySmTeamId[smId] : null;
            })() || {}),
          };

          // Find which team is localteam and which is visitorteam
          const localteamId = matchResponse.localteam_id;
          const visitorteamId = matchResponse.visitorteam_id;

          // Find corresponding scoreboards for localteam and visitorteam
          const localTeamTotal = scoreboards.find(
            (sb) => sb.team_id === localteamId && sb.type === "total"
          ) || {};

          const visitorTeamTotal = scoreboards.find(
            (sb) => sb.team_id === visitorteamId && sb.type === "total"
          ) || {};

          // Create enhanced DL data with actual scores
          const localteam_dl_data = {
            score: localTeamTotal.total || null,
            overs: localTeamTotal.overs || null,
            wickets_out: localTeamTotal.wickets || null,
          };

          const visitorteam_dl_data = {
            score: visitorTeamTotal.total || null,
            overs: visitorTeamTotal.overs || null,
            wickets_out: visitorTeamTotal.wickets || null,
          };

          // Compose scorecard payload
          const scorecardPayload = {
            note: matchResponse.note ?? null,
            localteam_dl_data: localteam_dl_data,
            visitorteam_dl_data: visitorteam_dl_data,
            summary: { team1: team1Summary, team2: team2Summary },
            extras: { team1: team1Extras, team2: team2Extras },
            scoreboards: Array.isArray(matchResponse.scoreboards) ? matchResponse.scoreboards : [],
            updated_at: new Date().toISOString(),
          };

          // Optionally set victory team in DB if present
          if (matchResponse.winner_team_id) {
            const winnerDbId = smToDbTeamMapFromBoards[String(matchResponse.winner_team_id)] || null;
            if (winnerDbId) {
              await trx("matches")
                .where({ id: matchId })
                .update({ victory_team_id: winnerDbId });
            }
          }

          // Update scorecard
          await trx("matches")
            .where({ id: matchId })
            .update({
              scorecard: JSON.stringify(scorecardPayload),
              updated_at: trx.fn.now()
            });
        }
      } catch (sbErr) {
        console.warn(`[insertMatchStats] Scoreboard update warning for match ${matchResponse.id}:`, sbErr.message || sbErr);
      }

      // 3. Process fielding statistics first (from batting data)
      try {
        if (Array.isArray(matchResponse.batting) && matchResponse.batting.length > 0) {
          // Collect all fielding player IDs and team IDs
          const fieldingPlayerIds = new Set();
          const fieldingTeamIds = new Set();

          // Track fielding stats by player_id
          const fieldingStats = {};

          for (const battingStat of matchResponse.batting) {
            // Process catches (from catch_stump_player_id when wicket is "Catch Out")
            if (battingStat.wicket?.name === "Catch Out" && battingStat.catch_stump_player_id) {
              const catcherId = String(battingStat.catch_stump_player_id);
              fieldingPlayerIds.add(catcherId);
              fieldingTeamIds.add(String(battingStat.team_id)); // Assume fielder is from opposite team

              if (!fieldingStats[catcherId]) {
                fieldingStats[catcherId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
              }
              fieldingStats[catcherId].catches += 1;
            }

            // Process stumpings (from catch_stump_player_id when wicket is "Stumped")
            if (battingStat.wicket?.name === "Stump Out" && battingStat.catch_stump_player_id) {
              const stumperId = String(battingStat.catch_stump_player_id);
              fieldingPlayerIds.add(stumperId);
              fieldingTeamIds.add(String(battingStat.team_id));

              if (!fieldingStats[stumperId]) {
                fieldingStats[stumperId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
              }
              fieldingStats[stumperId].stumpings += 1;
            }

            // Process run outs
            if (battingStat.wicket?.name === "Run Out") {
              // Regular run outs (both catch_stump_player_id and runout_by_id)
              if (battingStat.catch_stump_player_id) {
                const fielderId = String(battingStat.catch_stump_player_id);
                fieldingPlayerIds.add(fielderId);
                fieldingTeamIds.add(String(battingStat.team_id));

                if (!fieldingStats[fielderId]) {
                  fieldingStats[fielderId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
                }
                fieldingStats[fielderId].run_outs += 1;
              }

              if (battingStat.runout_by_id) {
                const runouterId = String(battingStat.runout_by_id);
                fieldingPlayerIds.add(runouterId);
                fieldingTeamIds.add(String(battingStat.team_id));

                if (!fieldingStats[runouterId]) {
                  fieldingStats[runouterId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
                }
                fieldingStats[runouterId].run_outs += 1;

                // Direct hit run outs (only runout_by_id, no catch_stump_player_id)
                if (!battingStat.catch_stump_player_id) {
                  fieldingStats[runouterId].run_outs_direct_hit += 1;
                }
              }
            }
          }

          // Get player and team mappings for fielding
          const fieldingPlayerArray = Array.from(fieldingPlayerIds);
          const fieldingTeamArray = Array.from(fieldingTeamIds);

          const fieldingPlayerRows = fieldingPlayerArray.length ?
            await trx("players").whereIn("player_id", fieldingPlayerArray) : [];
          const fieldingTeamRows = fieldingTeamArray.length ?
            await trx("teams").whereIn("team_id", fieldingTeamArray) : [];

          const fieldingPlayerMap = {};
          fieldingPlayerRows.forEach(row => {
            fieldingPlayerMap[String(row.player_id)] = row.id;
          });

          const fieldingTeamMap = {};
          fieldingTeamRows.forEach(row => {
            fieldingTeamMap[String(row.team_id)] = row.id;
          });

          // Update fielding statistics
          for (const [smPlayerId, stats] of Object.entries(fieldingStats)) {
            const dbPlayerId = fieldingPlayerMap[smPlayerId];
            if (!dbPlayerId) {
              console.warn(`Skipping fielding stat - player not found: player_id=${smPlayerId}`);
              continue;
            }

            // Find the player's team (we'll use the first team mapping or a default approach)
            const dbTeamId = Object.values(fieldingTeamMap)[0]; // Simplified - you might need better team resolution logic

            // Manual upsert for fielding statistics
            const existingRecord = await trx("player_match_statistics")
              .where({ match_id: matchId, player_id: dbPlayerId })
              .first();

            const fieldingData = {
              catches: stats.catches,
              run_outs: stats.run_outs,
              run_outs_direct_hit: stats.run_outs_direct_hit,
              stumpings: stats.stumpings,
              updated_at: new Date()
            };

            if (existingRecord) {
              // Update existing record with fielding stats
              await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .update(fieldingData);
            } else {
              // Insert new record with fielding stats only
              await trx("player_match_statistics").insert({
                match_id: matchId,
                player_id: dbPlayerId,
                team_id: dbTeamId,
                ...fieldingData
              });
            }
          }
        }
      } catch (fieldingErr) {
        console.warn(`[insertMatchStats] Fielding stats update warning for match ${matchResponse.id}:`, fieldingErr.message || fieldingErr);
      }

      // 4. Process batting statistics with manual upsert
      try {
        if (Array.isArray(matchResponse.batting) && matchResponse.batting.length > 0) {
          const battingTeamIds = [...new Set(matchResponse.batting.map(b => String(b.team_id)))];
          const battingPlayerIds = [...new Set(matchResponse.batting.map(b => String(b.player_id)))];

          // Get team mappings
          const battingTeamRows = await trx("teams").whereIn("team_id", battingTeamIds);
          const battingTeamMap = {};
          battingTeamRows.forEach(row => {
            battingTeamMap[String(row.team_id)] = row.id;
          });

          // Get player mappings
          const battingPlayerRows = await trx("players").whereIn("player_id", battingPlayerIds);
          const battingPlayerMap = {};
          battingPlayerRows.forEach(row => {
            battingPlayerMap[String(row.player_id)] = row.id;
          });

          // Process each batting record
          for (const battingStat of matchResponse.batting) {
            const dbTeamId = battingTeamMap[String(battingStat.team_id)];
            const dbPlayerId = battingPlayerMap[String(battingStat.player_id)];

            if (!dbTeamId || !dbPlayerId) {
              console.warn(`Skipping batting stat - missing mapping: team_id=${battingStat.team_id}, player_id=${battingStat.player_id}`);
              continue;
            }

            // Calculate strike rate
            const strikeRate = (battingStat.ball && battingStat.ball > 0) ?
              Number((battingStat.score / battingStat.ball * 100).toFixed(2)) : 0;

            // Determine dismissal info
            let dismissalType = null;
            let howOut = null;
            if (battingStat.wicket && battingStat.wicket.name) {
              dismissalType = battingStat.wicket.name;

              if (battingStat.wicket.name === "Catch Out" && battingStat.catch_stump_player_id) {
                howOut = `c ${battingStat.catch_stump_player_id} b ${battingStat.bowling_player_id}`;
              } else if (battingStat.wicket.name === "Clean Bowled") {
                howOut = `b ${battingStat.bowling_player_id}`;
              } else if (battingStat.wicket.name === "Run Out" && battingStat.runout_by_id) {
                howOut = `run out (${battingStat.runout_by_id})`;
              } else {
                howOut = `${battingStat.wicket.name} ${battingStat.bowling_player_id || ''}`.trim();
              }
            }

            const battingData = {
              match_id: matchId,
              player_id: dbPlayerId,
              team_id: dbTeamId,
              runs: battingStat.score || 0,
              balls_faced: battingStat.ball || 0,
              fours: battingStat.four_x || 0,
              sixes: battingStat.six_x || 0,
              strike_rate: strikeRate,
              dismissal_type: dismissalType,
              how_out: howOut,
              updated_at: new Date()
            };

            // Manual upsert for batting statistics
            const existingBattingRecord = await trx("player_match_statistics")
              .where({ match_id: matchId, player_id: dbPlayerId })
              .first();

            if (existingBattingRecord) {
              // Update existing record with batting stats
              await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .update({
                  runs: battingData.runs,
                  balls_faced: battingData.balls_faced,
                  fours: battingData.fours,
                  sixes: battingData.sixes,
                  strike_rate: battingData.strike_rate,
                  dismissal_type: battingData.dismissal_type,
                  how_out: battingData.how_out,
                  updated_at: battingData.updated_at
                });
            } else {
              // Insert new record
              await trx("player_match_statistics").insert(battingData);
            }
          }
        }
      } catch (battingErr) {
        console.warn(`[insertMatchStats] Batting stats update warning for match ${matchResponse.id}:`, battingErr.message || battingErr);
      }

      // 5. Process bowling statistics with manual upsert
      try {
        if (Array.isArray(matchResponse.bowling) && matchResponse.bowling.length > 0) {
          const bowlingTeamIds = [...new Set(matchResponse.bowling.map(b => String(b.team_id)))];
          const bowlingPlayerIds = [...new Set(matchResponse.bowling.map(b => String(b.player_id)))];

          // Get team mappings
          const bowlingTeamRows = await trx("teams").whereIn("team_id", bowlingTeamIds);
          const bowlingTeamMap = {};
          bowlingTeamRows.forEach(row => {
            bowlingTeamMap[String(row.team_id)] = row.id;
          });

          // Get player mappings
          const bowlingPlayerRows = await trx("players").whereIn("player_id", bowlingPlayerIds);
          const bowlingPlayerMap = {};
          bowlingPlayerRows.forEach(row => {
            bowlingPlayerMap[String(row.player_id)] = row.id;
          });

          // Process each bowling record
          for (const bowlingStat of matchResponse.bowling) {
            const dbTeamId = bowlingTeamMap[String(bowlingStat.team_id)];
            const dbPlayerId = bowlingPlayerMap[String(bowlingStat.player_id)];

            if (!dbTeamId || !dbPlayerId) {
              console.warn(`Skipping bowling stat - missing mapping: team_id=${bowlingStat.team_id}, player_id=${bowlingStat.player_id}`);
              continue;
            }

            // Calculate economy rate
            const economy = (bowlingStat.overs && bowlingStat.overs > 0) ?
              Number((bowlingStat.runs / bowlingStat.overs).toFixed(2)) : 0;

            const bowlingData = {
              overs: bowlingStat.overs || 0,
              maidens: bowlingStat.medians || 0,
              runs_conceded: bowlingStat.runs || 0,
              wickets: bowlingStat.wickets || 0,
              no_balls: bowlingStat.noball || 0,
              wides: bowlingStat.wide || 0,
              economy: economy,
              updated_at: new Date()
            };

            // Manual upsert for bowling statistics
            const existingBowlingRecord = await trx("player_match_statistics")
              .where({ match_id: matchId, player_id: dbPlayerId })
              .first();

            if (existingBowlingRecord) {
              // Update existing record with bowling stats
              await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .update(bowlingData);
            } else {
              // Insert new record with bowling stats only
              await trx("player_match_statistics").insert({
                match_id: matchId,
                player_id: dbPlayerId,
                team_id: dbTeamId,
                ...bowlingData
              });
            }
          }
        }
      } catch (bowlingErr) {
        console.warn(`[insertMatchStats] Bowling stats update warning for match ${matchResponse.id}:`, bowlingErr.message || bowlingErr);
      }

      // 6. Process dot balls from balls array
      try {
        if (Array.isArray(matchResponse.balls) && matchResponse.balls.length > 0) {
          const bowlerDotBalls = {};
          const bowlerConsecutiveDotPairs = {};

          // Sort balls by over & ball_no if not already sorted
          const sortedBalls = matchResponse.balls.sort((a, b) => {
            if (a.over === b.over) {
              return a.ball - b.ball;
            }
            return a.over - b.over;
          });

          // Track previous dot state per bowler
          const lastDotState = {};

          // Count dot balls and 2-consecutive-dot-ball pairs
          for (const ball of sortedBalls) {
            if (!ball.bowler_id || !ball.score) continue;

            const isValidBall = ball.score.ball === true;
            const isDotBall = isValidBall &&
              ball.score.runs === 0 &&
              ball.score.bye === 0 &&
              ball.score.leg_bye === 0 &&
              ball.score.noball === 0;

            const bowlerId = String(ball.bowler_id);

            if (isDotBall) {
              // Increment dot balls
              bowlerDotBalls[bowlerId] = (bowlerDotBalls[bowlerId] || 0) + 1;

              // Check for consecutive dot balls
              if (lastDotState[bowlerId] === true) {
                bowlerConsecutiveDotPairs[bowlerId] = (bowlerConsecutiveDotPairs[bowlerId] || 0) + 1;
                lastDotState[bowlerId] = false; // reset so overlapping pairs don’t count (2 balls only)
              } else {
                lastDotState[bowlerId] = true;
              }
            } else {
              lastDotState[bowlerId] = false; // reset streak
            }
          }

          // Get bowler mappings
          const bowlerIds = Object.keys(bowlerDotBalls);
          if (bowlerIds.length > 0) {
            const bowlerPlayerRows = await trx("players").whereIn("player_id", bowlerIds);
            const bowlerPlayerMap = {};
            bowlerPlayerRows.forEach(row => {
              bowlerPlayerMap[String(row.player_id)] = row.id;
            });

            // Update dot balls + consecutive pairs for each bowler
            for (const smBowlerId of bowlerIds) {
              const dbPlayerId = bowlerPlayerMap[smBowlerId];
              if (!dbPlayerId) {
                console.warn(`Skipping dot balls - bowler not found: player_id=${smBowlerId}`);
                continue;
              }

              const dotBallCount = bowlerDotBalls[smBowlerId] || 0;
              const consecutivePairs = bowlerConsecutiveDotPairs[smBowlerId] || 0;

              const existingRecord = await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .first();

              if (existingRecord) {
                await trx("player_match_statistics")
                  .where({ match_id: matchId, player_id: dbPlayerId })
                  .update({
                    dot_ball: dotBallCount,
                    dot_ball2: consecutivePairs,
                    updated_at: new Date()
                  });
              } else {
                console.warn(`No existing bowling record found for player ${dbPlayerId} in match ${matchId}`);
              }
            }
          }
        }
      } catch (dotBallsErr) {
        console.warn(`[insertMatchStats] Dot balls update warning for match ${matchResponse.id}:`, dotBallsErr.message || dotBallsErr);
      }

      // Return success result
      return {
        success: true,
        matchId: matchId,
        battingRecords: matchResponse.batting?.length || 0,
        bowlingRecords: matchResponse.bowling?.length || 0,
        processedAt: new Date().toISOString()
      };

    } catch (e) {
      console.error("[insertMatchStats] Error:", e);
      throw e;
    }
  });
};
function defaultStats(match_id, player_id, team_id) {
  return {
    match_id,
    player_id,
    team_id,
    runs: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    strike_rate: 0,
    dismissal_type: null,
    dismissal_bowler: null,
    dismissal_fielders: null,
    batting_status: null,
    overs_bowled: 0,
    maidens: 0,
    runs_conceded: 0,
    wickets: 0,
    economy_rate: 0,
    dots: 0,
    wides: 0,
    no_balls: 0,
    catches: 0,
    run_outs: 0,
    stumpings: 0,
    role: null,
    metadata: {},
  };
}

const insertMatchAndPlayerStats = async (matchResponse, db) => {
  return db.transaction(async (trx) => {
    try {
      // 1. Get our DB match id using the external id
      const matchRow = await trx("matches")
        .where({ sm_match_id: matchResponse.id })
        .first();

      if (!matchRow) {
        throw new Error(`Match not found in DB for sm_match_id: ${matchResponse.id}`);
      }

      const matchId = matchRow.id;

      // 2. Process scoreboard data
      try {
        const scoreboards = Array.isArray(matchResponse.scoreboards) ? matchResponse.scoreboards : [];

        if (scoreboards.length) {
          // Build map of SM team_id -> summary for totals and extras
          const totalsBySmTeamId = {};
          const extrasBySmTeamId = {};

          for (const sb of scoreboards) {
            if (sb && sb.type === "total") {
              totalsBySmTeamId[String(sb.team_id)] = {
                total: sb.total ?? 0,
                overs: sb.overs ?? 0,
                wickets: sb.wickets ?? 0,
                scoreboard: sb.scoreboard ?? null,
              };
            } else if (sb && sb.type === "extra") {
              extrasBySmTeamId[String(sb.team_id)] = {
                wide: sb.wide ?? 0,
                noball_runs: sb.noball_runs ?? 0,
                noball_balls: sb.noball_balls ?? 0,
                bye: sb.bye ?? 0,
                leg_bye: sb.leg_bye ?? 0,
                penalty: sb.penalty ?? 0,
                scoreboard: sb.scoreboard ?? null,
              };
            }
          }

          // Resolve SM team ids -> DB ids so we can align with team1 and team2
          const smTeamIds = Array.from(
            new Set([...Object.keys(totalsBySmTeamId), ...Object.keys(extrasBySmTeamId)])
          );
          const teamsMapRows = smTeamIds.length ? await trx("teams").whereIn("team_id", smTeamIds) : [];

          const smToDbTeamMapFromBoards = {};
          teamsMapRows.forEach((row) => {
            smToDbTeamMapFromBoards[String(row.team_id)] = row.id;
          });

          // Map summaries to team1/team2
          const team1Summary = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team1_id
              );
              return smId ? totalsBySmTeamId[smId] : null;
            })() || {}),
          };

          const team1Extras = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team1_id
              );
              return smId ? extrasBySmTeamId[smId] : null;
            })() || {}),
          };

          const team2Summary = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team2_id
              );
              return smId ? totalsBySmTeamId[smId] : null;
            })() || {}),
          };

          const team2Extras = {
            ...((() => {
              const smId = Object.keys(smToDbTeamMapFromBoards).find((k) =>
                smToDbTeamMapFromBoards[k] === matchRow.team2_id
              );
              return smId ? extrasBySmTeamId[smId] : null;
            })() || {}),
          };

          // Find which team is localteam and which is visitorteam
          const localteamId = matchResponse.localteam_id;
          const visitorteamId = matchResponse.visitorteam_id;

          // Find corresponding scoreboards for localteam and visitorteam
          const localTeamTotal = scoreboards.find(
            (sb) => sb.team_id === localteamId && sb.type === "total"
          ) || {};

          const visitorTeamTotal = scoreboards.find(
            (sb) => sb.team_id === visitorteamId && sb.type === "total"
          ) || {};

          // Create enhanced DL data with actual scores
          const localteam_dl_data = {
            score: localTeamTotal.total || null,
            overs: localTeamTotal.overs || null,
            wickets_out: localTeamTotal.wickets || null,
          };

          const visitorteam_dl_data = {
            score: visitorTeamTotal.total || null,
            overs: visitorTeamTotal.overs || null,
            wickets_out: visitorTeamTotal.wickets || null,
          };

          // Compose scorecard payload
          const scorecardPayload = {
            note: matchResponse.note ?? null,
            localteam_dl_data: localteam_dl_data,
            visitorteam_dl_data: visitorteam_dl_data,
            summary: { team1: team1Summary, team2: team2Summary },
            extras: { team1: team1Extras, team2: team2Extras },
            scoreboards: Array.isArray(matchResponse.scoreboards) ? matchResponse.scoreboards : [],
            updated_at: new Date().toISOString(),
          };

          // Optionally set victory team in DB if present
          if (matchResponse.winner_team_id) {
            const winnerDbId = smToDbTeamMapFromBoards[String(matchResponse.winner_team_id)] || null;
            if (winnerDbId) {
              await trx("matches")
                .where({ id: matchId })
                .update({ victory_team_id: winnerDbId });
            }
          }

          // Update scorecard
          await trx("matches")
            .where({ id: matchId })
            .update({
              scorecard: JSON.stringify(scorecardPayload),
              updated_at: trx.fn.now()
            });
        }
      } catch (sbErr) {
        console.warn(`[insertMatchStats] Scoreboard update warning for match ${matchResponse.id}:`, sbErr.message || sbErr);
      }

      // 3. Process fielding statistics first (from batting data)
      try {
        if (Array.isArray(matchResponse.batting) && matchResponse.batting.length > 0) {
          // Collect all fielding player IDs and team IDs
          const fieldingPlayerIds = new Set();
          const fieldingTeamIds = new Set();

          // Track fielding stats by player_id
          const fieldingStats = {};

          for (const battingStat of matchResponse.batting) {
            // Process catches (from catch_stump_player_id when wicket is "Catch Out")
            if (battingStat.wicket?.name === "Catch Out" && battingStat.catch_stump_player_id) {
              const catcherId = String(battingStat.catch_stump_player_id);
              fieldingPlayerIds.add(catcherId);
              fieldingTeamIds.add(String(battingStat.team_id)); // Assume fielder is from opposite team

              if (!fieldingStats[catcherId]) {
                fieldingStats[catcherId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
              }
              fieldingStats[catcherId].catches += 1;
            }

            // Process stumpings (from catch_stump_player_id when wicket is "Stumped")
            if (battingStat.wicket?.name === "Stump Out" && battingStat.catch_stump_player_id) {
              const stumperId = String(battingStat.catch_stump_player_id);
              fieldingPlayerIds.add(stumperId);
              fieldingTeamIds.add(String(battingStat.team_id));

              if (!fieldingStats[stumperId]) {
                fieldingStats[stumperId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
              }
              fieldingStats[stumperId].stumpings += 1;
            }

            // Process run outs
            if (battingStat.wicket?.name === "Run Out") {
              // Regular run outs (both catch_stump_player_id and runout_by_id)
              if (battingStat.catch_stump_player_id) {
                const fielderId = String(battingStat.catch_stump_player_id);
                fieldingPlayerIds.add(fielderId);
                fieldingTeamIds.add(String(battingStat.team_id));

                if (!fieldingStats[fielderId]) {
                  fieldingStats[fielderId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
                }
                fieldingStats[fielderId].run_outs += 1;
              }

              if (battingStat.runout_by_id) {
                const runouterId = String(battingStat.runout_by_id);
                fieldingPlayerIds.add(runouterId);
                fieldingTeamIds.add(String(battingStat.team_id));

                if (!fieldingStats[runouterId]) {
                  fieldingStats[runouterId] = { catches: 0, run_outs: 0, run_outs_direct_hit: 0, stumpings: 0 };
                }
                fieldingStats[runouterId].run_outs += 1;

                // Direct hit run outs (only runout_by_id, no catch_stump_player_id)
                if (!battingStat.catch_stump_player_id) {
                  fieldingStats[runouterId].run_outs_direct_hit += 1;
                }
              }
            }
          }

          // Get player and team mappings for fielding
          const fieldingPlayerArray = Array.from(fieldingPlayerIds);
          const fieldingTeamArray = Array.from(fieldingTeamIds);

          const fieldingPlayerRows = fieldingPlayerArray.length ?
            await trx("players").whereIn("player_id", fieldingPlayerArray) : [];
          const fieldingTeamRows = fieldingTeamArray.length ?
            await trx("teams").whereIn("team_id", fieldingTeamArray) : [];

          const fieldingPlayerMap = {};
          fieldingPlayerRows.forEach(row => {
            fieldingPlayerMap[String(row.player_id)] = row.id;
          });

          const fieldingTeamMap = {};
          fieldingTeamRows.forEach(row => {
            fieldingTeamMap[String(row.team_id)] = row.id;
          });

          // Update fielding statistics
          for (const [smPlayerId, stats] of Object.entries(fieldingStats)) {
            const dbPlayerId = fieldingPlayerMap[smPlayerId];
            if (!dbPlayerId) {
              console.warn(`Skipping fielding stat - player not found: player_id=${smPlayerId}`);
              continue;
            }

            // Find the player's team (we'll use the first team mapping or a default approach)
            const dbTeamId = Object.values(fieldingTeamMap)[0]; // Simplified - you might need better team resolution logic

            // Manual upsert for fielding statistics
            const existingRecord = await trx("player_match_statistics")
              .where({ match_id: matchId, player_id: dbPlayerId })
              .first();

            const fieldingData = {
              catches: stats.catches,
              run_outs: stats.run_outs,
              run_outs_direct_hit: stats.run_outs_direct_hit,
              stumpings: stats.stumpings,
              updated_at: new Date()
            };

            if (existingRecord) {
              // Update existing record with fielding stats
              await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .update(fieldingData);
            } else {
              // Insert new record with fielding stats only
              await trx("player_match_statistics").insert({
                match_id: matchId,
                player_id: dbPlayerId,
                team_id: dbTeamId,
                ...fieldingData
              });
            }
          }
        }
      } catch (fieldingErr) {
        console.warn(`[insertMatchStats] Fielding stats update warning for match ${matchResponse.id}:`, fieldingErr.message || fieldingErr);
      }

      // 4. Process batting statistics with manual upsert
      try {
        if (Array.isArray(matchResponse.batting) && matchResponse.batting.length > 0) {
          const battingTeamIds = [...new Set(matchResponse.batting.map(b => String(b.team_id)))];
          const battingPlayerIds = [...new Set(matchResponse.batting.map(b => String(b.player_id)))];

          // Get team mappings
          const battingTeamRows = await trx("teams").whereIn("team_id", battingTeamIds);
          const battingTeamMap = {};
          battingTeamRows.forEach(row => {
            battingTeamMap[String(row.team_id)] = row.id;
          });

          // Get player mappings
          const battingPlayerRows = await trx("players").whereIn("player_id", battingPlayerIds);
          const battingPlayerMap = {};
          battingPlayerRows.forEach(row => {
            battingPlayerMap[String(row.player_id)] = row.id;
          });

          // Process each batting record
          for (const battingStat of matchResponse.batting) {
            const dbTeamId = battingTeamMap[String(battingStat.team_id)];
            const dbPlayerId = battingPlayerMap[String(battingStat.player_id)];

            if (!dbTeamId || !dbPlayerId) {
              console.warn(`Skipping batting stat - missing mapping: team_id=${battingStat.team_id}, player_id=${battingStat.player_id}`);
              continue;
            }

            // Calculate strike rate
            const strikeRate = (battingStat.ball && battingStat.ball > 0) ?
              Number((battingStat.score / battingStat.ball * 100).toFixed(2)) : 0;

            // Determine dismissal info
            let dismissalType = null;
            let howOut = null;
            if (battingStat.wicket && battingStat.wicket.name) {
              dismissalType = battingStat.wicket.name;

              if (battingStat.wicket.name === "Catch Out" && battingStat.catch_stump_player_id) {
                howOut = `c ${battingStat.catch_stump_player_id} b ${battingStat.bowling_player_id}`;
              } else if (battingStat.wicket.name === "Clean Bowled") {
                howOut = `b ${battingStat.bowling_player_id}`;
              } else if (battingStat.wicket.name === "Run Out" && battingStat.runout_by_id) {
                howOut = `run out (${battingStat.runout_by_id})`;
              } else {
                howOut = `${battingStat.wicket.name} ${battingStat.bowling_player_id || ''}`.trim();
              }
            }

            const battingData = {
              match_id: matchId,
              player_id: dbPlayerId,
              team_id: dbTeamId,
              runs: battingStat.score || 0,
              balls_faced: battingStat.ball || 0,
              fours: battingStat.four_x || 0,
              sixes: battingStat.six_x || 0,
              strike_rate: strikeRate,
              dismissal_type: dismissalType,
              how_out: howOut,
              updated_at: new Date()
            };

            // Manual upsert for batting statistics
            const existingBattingRecord = await trx("player_match_statistics")
              .where({ match_id: matchId, player_id: dbPlayerId })
              .first();

            if (existingBattingRecord) {
              // Update existing record with batting stats
              await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .update({
                  runs: battingData.runs,
                  balls_faced: battingData.balls_faced,
                  fours: battingData.fours,
                  sixes: battingData.sixes,
                  strike_rate: battingData.strike_rate,
                  dismissal_type: battingData.dismissal_type,
                  how_out: battingData.how_out,
                  updated_at: battingData.updated_at
                });
            } else {
              // Insert new record
              await trx("player_match_statistics").insert(battingData);
            }
          }
        }
      } catch (battingErr) {
        console.warn(`[insertMatchStats] Batting stats update warning for match ${matchResponse.id}:`, battingErr.message || battingErr);
      }

      // 5. Process bowling statistics with manual upsert
      try {
        if (Array.isArray(matchResponse.bowling) && matchResponse.bowling.length > 0) {
          const bowlingTeamIds = [...new Set(matchResponse.bowling.map(b => String(b.team_id)))];
          const bowlingPlayerIds = [...new Set(matchResponse.bowling.map(b => String(b.player_id)))];

          // Get team mappings
          const bowlingTeamRows = await trx("teams").whereIn("team_id", bowlingTeamIds);
          const bowlingTeamMap = {};
          bowlingTeamRows.forEach(row => {
            bowlingTeamMap[String(row.team_id)] = row.id;
          });

          // Get player mappings
          const bowlingPlayerRows = await trx("players").whereIn("player_id", bowlingPlayerIds);
          const bowlingPlayerMap = {};
          bowlingPlayerRows.forEach(row => {
            bowlingPlayerMap[String(row.player_id)] = row.id;
          });

          // Process each bowling record
          for (const bowlingStat of matchResponse.bowling) {
            const dbTeamId = bowlingTeamMap[String(bowlingStat.team_id)];
            const dbPlayerId = bowlingPlayerMap[String(bowlingStat.player_id)];

            if (!dbTeamId || !dbPlayerId) {
              console.warn(`Skipping bowling stat - missing mapping: team_id=${bowlingStat.team_id}, player_id=${bowlingStat.player_id}`);
              continue;
            }

            // Calculate economy rate
            const economy = (bowlingStat.overs && bowlingStat.overs > 0) ?
              Number((bowlingStat.runs / bowlingStat.overs).toFixed(2)) : 0;

            const bowlingData = {
              overs: bowlingStat.overs || 0,
              maidens: bowlingStat.medians || 0,
              runs_conceded: bowlingStat.runs || 0,
              wickets: bowlingStat.wickets || 0,
              no_balls: bowlingStat.noball || 0,
              wides: bowlingStat.wide || 0,
              economy: economy,
              updated_at: new Date()
            };

            // Manual upsert for bowling statistics
            const existingBowlingRecord = await trx("player_match_statistics")
              .where({ match_id: matchId, player_id: dbPlayerId })
              .first();

            if (existingBowlingRecord) {
              // Update existing record with bowling stats
              await trx("player_match_statistics")
                .where({ match_id: matchId, player_id: dbPlayerId })
                .update(bowlingData);
            } else {
              // Insert new record with bowling stats only
              await trx("player_match_statistics").insert({
                match_id: matchId,
                player_id: dbPlayerId,
                team_id: dbTeamId,
                ...bowlingData
              });
            }
          }
        }
      } catch (bowlingErr) {
        console.warn(`[insertMatchStats] Bowling stats update warning for match ${matchResponse.id}:`, bowlingErr.message || bowlingErr);
      }

      // Return success result
      return {
        success: true,
        matchId: matchId,
        battingRecords: matchResponse.batting?.length || 0,
        bowlingRecords: matchResponse.bowling?.length || 0,
        processedAt: new Date().toISOString()
      };

    } catch (e) {
      console.error("[insertMatchStats] Error:", e);
      throw e;
    }
  });
};


module.exports = {
  insertTournaments,
  insertTeams,
  insertFixtures,
  insertTeamSquad,
  insertStages,
  insertVenues,
  insertCountries,
  insertFantasyPoints,
  insertMatchStats,
  insertMatchAndPlayerStats
};
