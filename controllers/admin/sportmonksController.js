const { knex: db } = require("../../config/database");
const config = require("../../config/config");
const apiResponse = require("../../utils/apiResponse");
const bcrypt = require("bcrypt");
const {
  slugGenrator,
  sendEmail,
  generatePlayerStats,
} = require("../../utils/functions");
const { ERROR, SPORTMONKS } = require("../../utils/responseMsg");
const sportmonksService = require("../../services/sportmonksService");
const tournamentDbService = require("../../services/tournamentDbService");
const scoreCalculation = require("../../services/scoreCalculation");
const SportMonksController = {
  // Get leagues (tournaments) and save to database ...........
  async getLeagues(req, res) {
    try {
      const include = "season";
      const response = await sportmonksService.getLeagues(include);
      if (!response?.data?.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noLeaguesFound,
          []
        );
      }
      // console.log(JSON.stringify(response.data, null, 2));

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
      const saveResult = await tournamentDbService.insertTournaments(
        response.data,
        db
      );
      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.leaguesSavedSuccessfully,
        {
          totalLeagues: response.data,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getLeagues:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  // Get team jo tournament me hai......
  async getSeasonsTeams(req, res) {
    try {
      const { tournamentId, seasonId } = req.body;
      const response = await sportmonksService.getSeasonsTeams(seasonId);
      if (!response?.data?.teams?.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noTeamsFound,
          []
        );
      }

      const saveResult = await tournamentDbService.insertTeams(
        response.data,
        db,
        tournamentId
      );
      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.teamsSavedSuccessfully,
        {
          totalTeams: response.data?.teams?.length,
          savedTeams: saveResult.length,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getSeasonsTeams:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  // Get matches by league ID (Tid) with optional includes.........
  async getSeasonsFixtures(req, res) {
    try {
      const { seasonId } = req.body;
      const response = await sportmonksService.getSeasonsFixtures(seasonId);

      if (!response?.data?.fixtures.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noFixturesFound,
          []
        );
      }
      // console.log(JSON.stringify(response.data, null, 2));

      const saveResult = await tournamentDbService.insertFixtures(
        response.data,
        db
      );

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.fixturesSavedSuccessfully,
        {
          totalFixtures: response.data.length,
          savedFixtures: saveResult.length,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getSeasonsFixtures:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get team players by team ID and season ID (TID)..............
  async getTeamSquad(req, res) {
    try {
      const { teamId, seasonId } = req.body;

      // First get the internal team DB ID
      const dbTeam = await db("teams").where({ team_id: teamId }).first();

      if (!dbTeam) {
        return apiResponse.ErrorResponse(res, "Team not found in database");
      }

      const response = await sportmonksService.getTeamSquadservice(
        teamId,
        seasonId
      ); // teamkiid or Tournamentid

      const saveResult = await tournamentDbService.insertTeamSquad(
        response.data,
        db,
        dbTeam.id // ✅ Add missing teamDbId parameter
      );

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.squadSavedSuccessfully,
        {
          totalPlayers: response.data.squad.length,
          savedPlayers: saveResult.length,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getTeamSquad:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get team details - SKIP
  async getTeamDetails(req, res) {
    try {
      const { teamId } = req.params;
      const response = await sportmonksService.getTeamDetails(teamId);

      if (!response?.data) {
        return apiResponse.ErrorResponse(res, SPORTMONKS.teamDetailsNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.teamDetailsFound,
        response.data
      );
    } catch (error) {
      console.error("Error in getTeamDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get player details - SKIP
  async getPlayerDetails(req, res) {
    try {
      const { playerId } = req.body;
      const response = await sportmonksService.getPlayerDetails(playerId);

      if (!response?.data) {
        return apiResponse.ErrorResponse(res, SPORTMONKS.playerDetailsNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.playerDetailsFound,
        response.data
      );
    } catch (error) {
      console.error("Error in getPlayerDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get and save season stages for a tournament......
  async getSeasonStages(req, res) {
    try {
      const tournaments = await db("tournaments")
        .select("*")
        .whereNotNull("tournament_id");

      if (!tournaments.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noTournamentsFound,
          { totalTournaments: 0 }
        );
      }

      const stageResults = [];

      for (const tournament of tournaments) {
        let metadata = tournament.metadata;
        let seasonId = null;

        if (metadata && typeof metadata === "object") {
          seasonId =
            metadata.season_id || (metadata.season ? metadata.season.id : null);
        } else if (typeof metadata === "string") {
          const parsedMetadata = JSON.parse(metadata);
          seasonId =
            parsedMetadata.season_id ||
            (parsedMetadata.season ? parsedMetadata.season.id : null);
        }

        if (!seasonId) {
          console.warn(
            `Season ID not found for tournament ID: ${tournament.tournament_id}. Skipping...`
          );
          continue;
        }

        try {
          const response = await sportmonksService.getSeasonStages(seasonId);

          if (response && response.data && response.data.stages) {
            const saveResult = await tournamentDbService.insertStages(
              response.data.stages,
              db,
              tournament.id
            );

            stageResults.push({
              tournamentId: tournament.id,
              seasonId,
              status: "success",
              stagesSaved: saveResult.length,
              totalStages: response.data.stages.length,
              message: SPORTMONKS.stagesSavedSuccessfully,
            });
          } else {
            stageResults.push({
              tournamentId: tournament.id,
              seasonId,
              status: "no stages found",
              totalStages: 0,
              message: SPORTMONKS.stagesNotFound,
            });
          }
        } catch (err) {
          console.warn(
            `Error fetching stages for season ${seasonId}:`,
            err.message || err
          );
          stageResults.push({
            tournamentId: tournament.id,
            seasonId,
            status: "error",
            error: err.message,
            totalStages: 0,
            message: SPORTMONKS.stagesFetchError,
          });
        }
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.stagesSavedSuccessfully,
        {
          totalTournaments: tournaments.length,
          results: stageResults,
        }
      );
    } catch (error) {
      console.error("Error in getSeasonStages:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get and save countries for a tournament.........
  async getCountries(req, res) {
    try {
      const response = await sportmonksService.getCountries();

      if (!response?.data?.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noCountriesFound,
          []
        );
      }

      const saveResult = await tournamentDbService.insertCountries(
        response.data,
        db
      );

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.countriesSavedSuccessfully,
        {
          totalCountries: response.data.length,
          savedCountries: saveResult.length,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getCountries:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get and save venues for a tournament............
  async getVenues(req, res) {
    try {
      const response = await sportmonksService.getVenues();

      if (!response?.data?.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noVenuesFound,
          []
        );
      }

      const saveResult = await tournamentDbService.insertVenues(
        response.data,
        db
      );

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.venuesSavedSuccessfully,
        {
          totalVenues: response.data.length,
          savedVenues: saveResult.length,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getVenues:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateAllPlayers(req, res) {
    try {
      const allPlayers = await db("players")
        .select("id as dbId", "player_id")
        .where("points", ">", 260); // jis player ko 260 h unhe update kro phle to

      console.log(`found ${allPlayers.length} to update`);

      if (!allPlayers.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noPlayersFound,
          { totalPlayers: 0 }
        );
      }

      const updateResults = [];

      for (const player of allPlayers) {
        const { player_id: playerId, dbId } = player;

        try {
          const response = await sportmonksService.getPlayerDetails(playerId);

          if (!response?.data) {
            updateResults.push({
              playerId,
              status: "error",
              message: SPORTMONKS.playerDetailsNotFound,
            });
            continue;
          }

          const role = response.data.position?.name || "Unknown";
          const playerStats = await generatePlayerStats(playerId, role);
          const recentSeasons = await sportmonksService.getPlayerCareerStats(
            playerId
          );

          // Played last match in last 12 months
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

          const playedLastMatch = recentSeasons.some((season) => {
            const seasonDate = new Date(season.updated_at);
            return (
              seasonDate >= twelveMonthsAgo &&
              ((season.batting?.matches || 0) > 0 ||
                (season.bowling?.matches || 0) > 0)
            );
          });

          await db("players").where({ id: dbId }).update({
            credits: playerStats.credits,
            points: playerStats.avgFantasyPoints,
            is_played_last_match: playedLastMatch,
            selected_by_percentage: playerStats.selectionPercent,
            updated_at: new Date(),
          });

          updateResults.push({
            playerId,
            status: "updated",
            credits: playerStats.credits,
            points: playerStats.avgFantasyPoints,
            lastMatchPlayed: playedLastMatch,
            matches: playerStats.totalMatches,
          });

          console.log(
            `✅ Updated playerId: ${playerId} - Credits: ${playerStats.credits}, Points: ${playerStats.avgFantasyPoints}`
          );
        } catch (err) {
          console.error(`❌ Error processing playerId ${playerId}:`, err);
          updateResults.push({
            playerId,
            status: "error",
            message: ERROR.somethingWrong,
            error: err.message,
          });
        }
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.playersUpdatedSuccessfully,
        {
          totalPlayers: allPlayers.length,
          processed: updateResults.filter((r) => r.status !== "error").length,
          errors: updateResults.filter((r) => r.status === "error").length,
          results: updateResults,
        }
      );
    } catch (error) {
      console.error("Error in updateAllPlayers:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getPlayerLastMatch(playerId) {
    try {
      const response = awaitaxios.get(`${this.baseURL}/players/${playerId}`, {
        params: { api_token: this.apiKey },
        include: "career.season",
      });

      // API response में last match batting और bowling stats होंगे
      return response.data?.data;
    } catch (error) {
      console.error(
        `Error fetching last match for player ${playerId}:`,
        error.response?.data || error.message
      );
      return null; // error होने पर null return करें
    }
  },

  async getScores(req, res) {
    try {
      const response = await sportmonksService.getScoreDetails();

      if (!response?.data?.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noVenuesFound,
          []
        );
      }

      const saveResult = await tournamentDbService.insertFantasyPoints(
        response.data,
        db
      );

      return apiResponse.successResponseWithData(
        res,
        "Scores saved successfully",
        {
          totalScores: response.data.length,
          data: saveResult,
        }
      );
    } catch (error) {
      console.error("Error in getVenues:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFixtureDetails(req, res) {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get today's matches that need updating
      const matches = await db("matches")
        .where("start_time", ">=", todayStart)
        .where("start_time", "<=", todayEnd)
        .whereNotIn("status", ["Finished", "Completed", "Aban."])
        .select("id", "sm_match_id", "status", "start_time", "metadata");

      // Define status groups
      const liveStatuses = [
        "Live",
        "1st Innings",
        "2nd Innings",
        "3rd Innings",
        "4th Innings",
        "Innings Break",
        "Stump Day 1",
        "Stump Day 2",
        "Stump Day 3",
        "Stump Day 4",
        "Tea Break",
        "Lunch",
        "Dinner",
        "Delayed", // ✅ Added delayed here
      ];

      const upcomingStatuses = ["NS", "Not Started", "Delayed"];

      // Filter matches to process
      const filteredMatches = matches.filter((match) => {
        if (upcomingStatuses.includes(match.status)) return true;
        if (liveStatuses.includes(match.status)) return true;
        return false;
      });

      console.log(
        `Filtered to ${filteredMatches.length} matches to update (from ${matches.length})`
      );

      let processed = 0;
      let skipped = 0;
      let scoreboardsUpdated = 0;
      const BASE_DELAY = 1500;

      for (const match of filteredMatches) {
        try {
          const matchId = match.sm_match_id;

          // Always get full fixture details
          const response = await sportmonksService.getFixtureDetails(matchId);

          if (!response || !response.data) {
            console.warn(
              `[getFixtureDetails] Empty response for match ${match.id} (sm ${matchId}); skipping`
            );
            skipped++;
            await new Promise((r) => setTimeout(r, BASE_DELAY));
            continue;
          }

          const apiData = response.data;

          // For live/delayed matches, also get scoreboards
          let scoreboardData = null;
          if (
            [
              "Live",
              "1st Innings",
              "2nd Innings",
              "3rd Innings",
              "4th Innings",
              "Delayed", // ✅ Added delayed here
            ].includes(match.status)
          ) {
            try {
              const scoreboardResponse =
                await sportmonksService.getFixtureScoreboards(matchId);
              if (scoreboardResponse && scoreboardResponse.data) {
                scoreboardData = scoreboardResponse.data;
                scoreboardsUpdated++;
                console.log(
                  `Scoreboard data fetched for live/delayed match ${match.id}`
                );
              }
            } catch (scoreboardErr) {
              console.warn(
                `Failed to fetch scoreboard for match ${match.id}:`,
                scoreboardErr.message
              );
            }
          }

          // Prepare metadata update
          const currentMetadata = match.metadata || {};
          const updatedMetadata = {
            ...currentMetadata,
            id: apiData.id,
            live: apiData.live,
            note: apiData.note,
            type: apiData.type,
            round: apiData.round,
            status: apiData.status,
            elected: apiData.elected,
            resource: apiData.resource,
            stage_id: apiData.stage_id,
            venue_id: apiData.venue_id,
            follow_on: apiData.follow_on,
            league_id: apiData.league_id,
            rpc_overs: apiData.rpc_overs,
            season_id: apiData.season_id,
            referee_id: apiData.referee_id,
            rpc_target: apiData.rpc_target,
            super_over: apiData.super_over,
            last_period: apiData.last_period,
            starting_at: apiData.starting_at,
            localteam_id: apiData.localteam_id,
            tv_umpire_id: apiData.tv_umpire_id,
            draw_noresult: apiData.draw_noresult,
            visitorteam_id: apiData.visitorteam_id,
            weather_report: apiData.weather_report || [],
            winner_team_id: apiData.winner_team_id,
            first_umpire_id: apiData.first_umpire_id,
            man_of_match_id: apiData.man_of_match_id,
            man_of_series_id: apiData.man_of_series_id,
            second_umpire_id: apiData.second_umpire_id,
            toss_won_team_id: apiData.toss_won_team_id,
            total_overs_played: apiData.total_overs_played,
            // Preserve DL data if it exists
            localteam_dl_data:
              currentMetadata.localteam_dl_data || apiData.localteam_dl_data,
            visitorteam_dl_data:
              currentMetadata.visitorteam_dl_data ||
              apiData.visitorteam_dl_data,
          };

          // Prepare update payload
          const updatePayload = {
            status: apiData.status || match.status,
            metadata: JSON.stringify(updatedMetadata),
            updated_at: new Date(),
          };

          // Add scorecard data if available
          if (scoreboardData) {
            updatePayload.scorecard = JSON.stringify(scoreboardData);
          }

          // Set end time for finished matches
          if (apiData.status && apiData.status.toLowerCase() === "finished") {
            updatePayload.end_time = new Date();
          }

          console.log(
            "Updating match:",
            match.id,
            "with status:",
            updatePayload.status
          );

          // Update the match in database
          await db("matches").where({ id: match.id }).update(updatePayload);

          // Prepare data for insertMatchStats
          const combinedData = {
            ...apiData,
            scoreboards:
              scoreboardData?.scoreboards || apiData.scoreboards || [],
          };

          // Update match stats
          await tournamentDbService.insertMatchStats(combinedData, db);

          processed++;
          await new Promise((r) => setTimeout(r, BASE_DELAY));
        } catch (err) {
          console.error(`Error processing match ${match.id}:`, err);
          skipped++;
        }
      }

      return apiResponse.successResponseWithData(
        res,
        "Today's matches updated successfully",
        { processed, skipped, scoreboardsUpdated }
      );
    } catch (error) {
      console.error("Error in getFixtureDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async refreshMatchScoreboards(req, res) {
    try {
      const { matchId } = req.params;

      const match = await db("matches")
        .where({ id: matchId })
        .orWhere({ sm_match_id: matchId })
        .first();

      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found");
      }

      // Fetch full details including balls for complete data
      const resp = await sportmonksService.getFixtureScoreboards(
        match.sm_match_id
      );
      if (!resp || !resp.data) {
        return apiResponse.ErrorResponse(res, "No data from provider");
      }

      const result = await tournamentDbService.insertMatchStats(resp.data, db);

      return apiResponse.successResponseWithData(res, "Scoreboards refreshed", {
        match_id: match.id,
        sm_match_id: match.sm_match_id,
        updated: true,
        rows_upserted: result.length || 0,
      });
    } catch (error) {
      console.error("Error in refreshMatchScoreboards:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  },

  // New controller to keep live scoreboards updated - OPTIMIZED for today's matches only
  async updateLiveScoreboards(req, res) {
    try {
      const nowUtc = new Date();
      const nowIST = new Date(
        nowUtc.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );

      const todayStartIST = new Date(nowIST);
      todayStartIST.setHours(0, 0, 0, 0);

      // End of today IST
      const todayEndIST = new Date(nowIST);
      todayEndIST.setHours(23, 59, 59, 999);



      const todayStart = new Date(
        todayStartIST.getTime() - 5.5 * 60 * 60 * 1000
      );
      const todayEnd = new Date(todayEndIST.getTime() - 5.5 * 60 * 60 * 1000);
      const now = nowUtc;
      const soon = new Date(now.getTime() + 2 * 60 * 60000); // 2 hours ahead

      const liveMatches = await db("matches")
        .where("start_time", ">=", todayStart)
        .where("start_time", "<=", todayEnd)
        .whereIn("status", [
          // "Live",
          // "NS",
          "1st Innings",
          "2nd Innings",
          "3rd Innings",
          "4th Innings",
          "Innings Break",
          "Stump Day 1",
          "Stump Day 2",
          "Stump Day 3",
          "Stump Day 4",

          "Tea Break",
          "Lunch",
          "Dinner",
        ])
        .whereNotIn("status", ["Finished", "Completed"])
        .select("id", "sm_match_id", "status");

      const upcomingMatches = await db("matches")
        .where("start_time", ">=", now)
        .where("start_time", "<=", soon)
        .where("start_time", ">=", todayStart)
        .where("start_time", "<=", todayEnd)
        .whereNotIn("status", ["Finished", "Completed"])
        .whereIn("status", ["NS", "Not Started", "Delayed"])
        .select("id", "sm_match_id", "status");

      //  recently finished matches past 3 din se aaj end hue vo 
      const recentlyFinished = await db("matches")
        .where("start_time", ">=", new Date(todayStart.getTime() - 3 * 24 * 60 * 60 * 1000))
        .where("start_time", "<=", todayEnd)
        .whereIn("status", ["Finished", "Completed", "Stumps"])
        .select("id", "sm_match_id", "status");

      console.log(
        `Found ${liveMatches.length} live matches, ${upcomingMatches.length} upcoming matches, and ${recentlyFinished.length} finished matches (TODAY ONLY)`
      );

      let processed = 0;
      let errors = 0;
      let scoreboardsUpdated = 0;
      const processedIds = [];
      const scoreboardUpdatedIds = [];

      const DELAY = 1500;

      for (const match of liveMatches) {
        console.log("Processing live match:", match.id);
        try {
          let fixtureDetails = null;
          let scoreboardData = null;

          // For live matches, get both fixture details and scoreboards
          try {
            const response = await sportmonksService.getFixtureDetails(
              match.sm_match_id
            );
            if (response && response.data) {
              fixtureDetails = response.data;
            }
          } catch (fixtureErr) {
            console.warn(
              `Failed to fetch fixture details for live match ${match.id}:`,
              fixtureErr.message
            );
          }

          // Also fetch scoreboards for live matches
          try {
            const scoreboardResp =
              await sportmonksService.getFixtureScoreboards(match.sm_match_id);
            if (scoreboardResp && scoreboardResp.data) {
              scoreboardData = scoreboardResp.data;
              scoreboardsUpdated++;
              scoreboardUpdatedIds.push(match.sm_match_id);
            }
          } catch (scoreboardErr) {
            console.warn(
              `Failed to fetch scoreboards for live match ${match.id}:`,
              scoreboardErr.message
            );
          }

          // Update match status and stats
          if (fixtureDetails || scoreboardData) {
            const updatePayload = {
              updated_at: new Date(),
            };

            if (fixtureDetails?.status) {
              updatePayload.status = fixtureDetails.status;
            }

            // if ((fixtureDetails?.status || "").toLowerCase() === "finished") {
            //   updatePayload.end_time = new Date();
            // }

            await db("matches").where({ id: match.id }).update(updatePayload);
          }

          // Process fixture stats (includes scorecard update)
          if (fixtureDetails) {
            await tournamentDbService.insertMatchStats(fixtureDetails, db);
          }

          // Process scoreboard data
          if (scoreboardData) {
            await tournamentDbService.insertMatchStats(scoreboardData, db);
          }

          processed++;
          processedIds.push(match.sm_match_id);
          await new Promise((r) => setTimeout(r, DELAY));
        } catch (err) {
          console.error(`Error processing live match ${match.id}:`, err);
          errors++;
        }
      }

      for (const match of upcomingMatches) {
        try {
          console.log("Processing upcoming match:", match.id);

          // For upcoming matches, get only fixture details (no scoreboards to save API calls)
          try {
            const response = await sportmonksService.getFixtureDetails(
              match.sm_match_id
            );
            if (response && response.data) {
              // Update match status
              const updatePayload = {
                status: response.data.status,
                updated_at: new Date(),
              };

              await db("matches").where({ id: match.id }).update(updatePayload);

              // Process fixture details
              await tournamentDbService.insertMatchStats(response.data, db);
              processed++;
              processedIds.push(match.sm_match_id);
            }
          } catch (fixtureErr) {
            console.warn(
              `Failed to fetch fixture details for upcoming match ${match.id}:`,
              fixtureErr.message
            );
          }

          // Add delay to avoid rate limits
          await new Promise((r) => setTimeout(r, DELAY));
        } catch (err) {
          console.error(`Error processing upcoming match ${match.id}:`, err);
          errors++;
        }
      }

      for (const match of recentlyFinished) {
        try {
          console.log("Processing finished match:", match.id);
          let fixtureDetails = null;
          let scoreboardData = null;

          try {
            const response = await sportmonksService.getFixtureDetails(
              match.sm_match_id
            );
            if (response?.data) fixtureDetails = response.data;
          } catch (err) {
            console.warn(`Fixture fetch failed [finished ${match.id}]:`, err.message);
          }

          try {
            const scoreboardResp = await sportmonksService.getFixtureScoreboards(
              match.sm_match_id
            );
            if (scoreboardResp?.data) {
              scoreboardData = scoreboardResp.data;
              scoreboardsUpdated++;
              scoreboardUpdatedIds.push(match.sm_match_id);
            }
          } catch (err) {
            console.warn(
              `Scoreboard fetch failed [finished ${match.id}]:`,
              err.message
            );
          }

          if (fixtureDetails || scoreboardData) {
            const updatePayload = {
              updated_at: new Date(),
              status: fixtureDetails?.status || match.status,
            };

            if (
              !match.end_time &&
              (fixtureDetails?.status || "").toLowerCase() === "finished"
            ) {
              updatePayload.end_time = new Date();
            }

            await db("matches").where({ id: match.id }).update(updatePayload);
          }

          if (fixtureDetails) {
            await tournamentDbService.insertMatchStats(fixtureDetails, db);
          }
          if (scoreboardData) {
            await tournamentDbService.insertMatchStats(scoreboardData, db);
          }

          processed++;
          processedIds.push(match.sm_match_id);
          await new Promise((r) => setTimeout(r, DELAY));
        } catch (err) {
          console.error(`Error processing finished match ${match.id}:`, err);
          errors++;
        }
      }

      return apiResponse.successResponseWithData(
        res,
        "Today's match scoreboards updated",
        {
          live_matches: liveMatches.length,
          upcoming_matches: upcomingMatches.length,
          finished_matches: recentlyFinished.length,
          processed,
          errors,
          scoreboards_updated: scoreboardsUpdated,
          processed_match_ids: processedIds,
          scoreboard_updated_ids: scoreboardUpdatedIds,
        }
      );
    } catch (error) {
      console.error("Error in updateLiveScoreboards:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },


  async scoreCalculation(req, res) {
    try {
      const response = await scoreCalculation.updateLeaderboardForTodayMatches(
        db
      );

      return apiResponse.successResponse(
        res,
        SPORTMONKS.venuesSavedSuccessfully
      );
    } catch (error) {
      console.error("Error in getVenues:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // to sync all tournaments data from tournamentId to teams , squads
  async syncAllTournamentTeams(req, res) {
    try {
      const tournaments = await db("tournaments")
        .select("*")
        .whereNotNull("tournament_id");

      if (!tournaments.length) {
        return apiResponse.ErrorResponse(res, SPORTMONKS.noTournamentsFound);
      }

      const results = [];

      for (const tournament of tournaments) {
        let seasonId = tournament.season;

        if (!seasonId) {
          console.log(SPORTMONKS.seasonIdNotFound);
          results.push({
            tournamentId: tournament.id,
            status: "error",
            message: SPORTMONKS.seasonIdNotFound,
          });
          continue;
        }

        console.log(
          `Processing Season ID: ${seasonId} for Tournament DB ID: ${tournament.id}`
        );

        try {
          const response = await sportmonksService.getSeasonsTeams(seasonId);
          const saveResult = await tournamentDbService.insertTeams(
            response.data,
            db,
            tournament.id
          );

          results.push({
            tournamentId: tournament.id,
            seasonId,
            status: "success",
            totalTeams: response.data.teams?.length ?? 0,
            data: saveResult,
          });
        } catch (err) {
          console.warn(SPORTMONKS.teamsFetchError, err);
          results.push({
            tournamentId: tournament.id,
            seasonId,
            status: "error",
            error: err.message,
            message: SPORTMONKS.teamsFetchError,
          });
        }
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.dataSyncedSuccessfully,
        {
          totalTournaments: tournaments.length,
          results,
        }
      );
    } catch (error) {
      console.error("Error in syncAllTournamentData:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // async syncAllTournamentData(req, res) {
  //   try {
  //     const tournaments = await db("tournaments")
  //       .select("*")
  //       .whereNotNull("tournament_id");

  //     if (!tournaments.length) {
  //       return apiResponse.ErrorResponse(res, SPORTMONKS.noTournamentsFound);
  //     }

  //     const results = [];
  //     const DELAY_MS = 1000;

  //     for (const tournament of tournaments) {
  //       let metadata = tournament.metadata;
  //       const seasonId = tournament.season; // Use the direct season column

  //       // if (metadata && typeof metadata === "object") {
  //       //   seasonId =
  //       //     metadata.season_id || (metadata.season ? metadata.season.id : null);
  //       // } else if (typeof metadata === "string") {
  //       //   const parsedMetadata = JSON.parse(metadata);
  //       //   seasonId =
  //       //     parsedMetadata.season_id ||
  //       //     (parsedMetadata.season ? parsedMetadata.season.id : null);
  //       // }

  //       if (!seasonId) {
  //         console.log(SPORTMONKS.seasonIdNotFound);
  //         results.push({
  //           tournamentId: tournament.id,
  //           status: "error",
  //           message: SPORTMONKS.seasonIdNotFound,
  //         });
  //         continue;
  //       }

  //       console.log(
  //         `Processing Season ID: ${seasonId} for Tournament DB ID: ${tournament.id}`
  //       );

  //       try {
  //         // Fetch & save Teams
  //         const teamsResult = await sportmonksService.getSeasonsTeams(seasonId);

  //         let teamsSaved = 0;

  //         if (teamsResult && teamsResult.data) {
  //           await tournamentDbService.insertTeams(
  //             teamsResult.data,
  //             db,
  //             tournament.id
  //           );
  //           teamsSaved = teamsResult.data.length;
  //         }

  //         // Fetch & save Fixtures (matches)
  //         const fixturesResult = await sportmonksService.getSeasonsFixtures(
  //           seasonId
  //         );
  //         let fixturesSaved = 0;

  //         if (fixturesResult && fixturesResult.data) {
  //           await tournamentDbService.insertFixtures(
  //             fixturesResult.data,
  //             db,
  //             tournament.id
  //           );
  //           fixturesSaved = fixturesResult.data.length;
  //         }

  //         // Fetch & save Squad team players for each Team
  //         const squadResult = await sportmonksService.getSeasonsTeams(seasonId);

  //         let playersSaved = 0;

  //         if (squadResult && squadResult.data?.teams) {
  //           const teams = squadResult.data.teams;

  //           for (const team of teams) {
  //             // console.log("team",team)
  //             try {
  //               const dbTeam = await db("teams")
  //                 .where({ team_id: team.id })
  //                 .first();

  //               if (!dbTeam) {
  //                 console.warn(SPORTMONKS.teamNotFoundInDB);
  //                 continue;
  //               }

  //               const dbTeamId = dbTeam.id;
  //               const teamSquadResponse =
  //                 await sportmonksService.getTeamSquadservice(
  //                   team.id,
  //                   seasonId
  //                 );
  //                 // console.log("dbTeamIddbTeamId",dbTeamId)

  //               if (teamSquadResponse && teamSquadResponse.data) {
  //                 await tournamentDbService.insertTeamSquad(
  //                   teamSquadResponse.data,
  //                   db,
  //                   dbTeamId,
  //                   team.id,
  //                   seasonId
  //                 );
  //                 playersSaved += teamSquadResponse.data.length;
  //               }
  //             } catch (err) {
  //               console.warn(SPORTMONKS.squadFetchError);
  //             }
  //           }
  //         }

  //         const matchResults = await sportmonksService.getSeasonsFixtures(
  //           seasonId
  //         );
  //         let statsSaved = 0;
  //         if (matchResults && Array.isArray(matchResults.data)) {
  //           for (const fixture of matchResults.data) {
  //             try {
  //               const matchResponse = await sportmonksService.getFixtureDetails(
  //                 fixture.id
  //               ); // Assume this exists
  //               if (matchResponse && matchResponse.data) {
  //                 const stats = await tournamentDbService.insertMatchStats(
  //                   matchResponse.data,
  //                   db
  //                 );
  //                 statsSaved += stats.length;
  //               }
  //             } catch (err) {
  //               console.warn(
  //                 `Error processing match stats for fixture ${fixture.id}: ${err.message}`
  //               );
  //             }
  //           }
  //         }

  //         results.push({
  //           tournamentId: tournament.id,
  //           seasonId,
  //           status: "success",
  //           teamsSaved,
  //           fixturesSaved,
  //           playersSaved,
  //           message: SPORTMONKS.dataSyncedSuccessfully,
  //         });
  //       } catch (err) {
  //         console.warn(SPORTMONKS.teamsFetchError);
  //         results.push({
  //           tournamentId: tournament.id,
  //           seasonId,
  //           status: "error",
  //           error: err.message,
  //           message: SPORTMONKS.teamsFetchError,
  //         });
  //       }
  //     }

  //     return apiResponse.successResponseWithData(
  //       res,
  //       SPORTMONKS.dataSyncedSuccessfully,
  //       {
  //         totalTournaments: tournaments.length,
  //         results,
  //       }
  //     );
  //   } catch (error) {
  //     console.error("Error in syncAllTournamentData:", error);
  //     return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  //   }
  // },
  // every 15-20 minute

  // updated
  async syncAllTournamentData(req, res) {
    try {
      const tournaments = await db("tournaments")
        .select("*")
        .whereNotNull("tournament_id");

      if (!tournaments.length) {
        return apiResponse.ErrorResponse(res, SPORTMONKS.noTournamentsFound);
      }

      const results = [];
      const DELAY_MS = 1000;

      for (const tournament of tournaments) {
        const seasonId = tournament.season;

        if (!seasonId) {
          results.push({
            tournamentId: tournament.id,
            status: "error",
            message: SPORTMONKS.seasonIdNotFound,
          });
          continue;
        }

        try {
          console.log(
            `Processing Season ID: ${seasonId} for Tournament: ${tournament.name}`
          );

          // 1. Fetch & save Teams
          const teamsResult = await sportmonksService.getSeasonsTeams(seasonId);
          let teamsSaved = 0;

          if (teamsResult && teamsResult.data) {
            await tournamentDbService.insertTeams(
              teamsResult.data,
              db,
              tournament.id
            );
            teamsSaved = teamsResult.data.teams?.length || 0;
          }

          // 2. Fetch & save Fixtures
          const fixturesResult = await sportmonksService.getSeasonsFixtures(
            seasonId
          );
          let fixturesSaved = 0;

          if (fixturesResult && fixturesResult.data) {
            await tournamentDbService.insertFixtures(
              fixturesResult.data,
              db,
              tournament.id
            );
            fixturesSaved = fixturesResult.data.fixtures?.length || 0;
          }

          // 3. Fetch & save Squad for each Team
          let playersSaved = 0;

          if (teamsResult && teamsResult.data?.teams) {
            const teams = teamsResult.data.teams;

            for (const team of teams) {
              try {
                const dbTeam = await db("teams")
                  .where({ team_id: team.id })
                  .first();

                if (!dbTeam) {
                  console.warn(`Team ${team.name} not found in DB`);
                  continue;
                }

                // Get squad for this team
                const squadResponse =
                  await sportmonksService.getTeamSquadservice(
                    team.id,
                    seasonId
                  );

                if (squadResponse && squadResponse.data) {
                  const saveResult = await tournamentDbService.insertTeamSquad(
                    squadResponse.data,
                    db,
                    dbTeam.id,
                    team.id,
                    seasonId // Add seasonId parameter
                  );
                  playersSaved += saveResult.length;
                }

                // Add delay to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
              } catch (err) {
                console.warn(
                  `Error processing team ${team.name}:`,
                  err.message
                );
              }
            }
          }

          results.push({
            tournamentId: tournament.id,
            seasonId,
            status: "success",
            teamsSaved,
            fixturesSaved,
            playersSaved,
            message: SPORTMONKS.dataSyncedSuccessfully,
          });
        } catch (err) {
          console.warn(
            `Error processing tournament ${tournament.id}:`,
            err.message
          );
          results.push({
            tournamentId: tournament.id,
            seasonId,
            status: "error",
            error: err.message,
            message: SPORTMONKS.teamsFetchError,
          });
        }
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.dataSyncedSuccessfully,
        {
          totalTournaments: tournaments.length,
          results,
        }
      );
    } catch (error) {
      console.error("Error in syncAllTournamentData:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncAllTournamentData2(req, res) {
    try {
      const tournaments = await db("tournaments")
        .select("*")
        .whereNotNull("tournament_id");

      if (!tournaments.length) {
        return apiResponse.ErrorResponse(res, SPORTMONKS.noTournamentsFound);
      }

      const results = [];

      for (const tournament of tournaments) {
        let metadata = tournament.metadata;
        let seasonId = null;

        if (metadata && typeof metadata === "object") {
          seasonId =
            metadata.season_id || (metadata.season ? metadata.season.id : null);
        } else if (typeof metadata === "string") {
          const parsedMetadata = JSON.parse(metadata);
          seasonId =
            parsedMetadata.season_id ||
            (parsedMetadata.season ? parsedMetadata.season.id : null);
        }

        if (!seasonId) {
          console.log(SPORTMONKS.seasonIdNotFound);
          results.push({
            tournamentId: tournament.id,
            status: "error",
            message: SPORTMONKS.seasonIdNotFound,
          });
          continue;
        }

        console.log(
          `Processing Season ID: ${seasonId} for Tournament DB ID: ${tournament.id}`
        );

        try {
          // Fetch & save Teams
          const teamsResult = await sportmonksService.getSeasonsTeams(seasonId);

          let teamsSaved = 0;

          if (teamsResult && teamsResult.data) {
            await tournamentDbService.insertTeams(
              teamsResult.data,
              db,
              tournament.id
            );
            teamsSaved = teamsResult.data.length;
          }

          // Fetch & save Fixtures
          const fixturesResult = await sportmonksService.getSeasonsFixtures(
            seasonId
          );
          let fixturesSaved = 0;

          if (fixturesResult && fixturesResult.data) {
            await tournamentDbService.insertFixtures(
              fixturesResult.data,
              db,
              tournament.id
            );
            fixturesSaved = fixturesResult.data.length;
          }

          results.push({
            tournamentId: tournament.id,
            seasonId,
            status: "success",
            teamsSaved,
            fixturesSaved,
            message: SPORTMONKS.dataSyncedSuccessfully,
          });
        } catch (err) {
          console.warn(SPORTMONKS.teamsFetchError);
          results.push({
            tournamentId: tournament.id,
            seasonId,
            status: "error",
            error: err.message,
            message: SPORTMONKS.teamsFetchError,
          });
        }
      }

      return apiResponse.successResponseWithData(
        res,
        SPORTMONKS.dataSyncedSuccessfully,
        {
          totalTournaments: tournaments.length,
          results,
        }
      );
    } catch (error) {
      console.error("Error in syncAllTournamentData:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncMatchPlayers(req, res) {
    try {
      const { matchId } = req.params;

      // Get match details from database (accepts either DB id or SportMonks sm_match_id)
      const match = await db("matches")
        .where({ id: matchId })
        .orWhere({ sm_match_id: matchId })
        .first();

      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found");
      }

      // Get teams from database
      const teams = await db("teams")
        .whereIn("id", [match.team1_id, match.team2_id])
        .select("*");

      if (teams.length !== 2) {
        return apiResponse.ErrorResponse(res, "Teams not found for this match");
      }

      // Get season ID from tournament
      const tournament = await db("tournaments")
        .where({ id: match.tournament_id })
        .first();

      if (!tournament || !tournament.season) {
        return apiResponse.ErrorResponse(res, "Tournament or season not found");
      }

      const seasonId = tournament.season;
      const results = [];

      // Sync players for both teams
      for (const team of teams) {
        try {
          console.log(`Syncing players for team ${team.name} (ID: ${team.id})`);

          // Get squad from SportMonks
          const squadResponse = await sportmonksService.getTeamSquadservice(
            team.team_id,
            seasonId
          );

          // Insert squad into database
          const saveResult = await tournamentDbService.insertTeamSquad(
            squadResponse.data,
            db,
            team.id,
            seasonId
          );

          results.push({
            team_id: team.id,
            team_name: team.name,
            players_synced: saveResult.length,
            status: "success",
          });
        } catch (error) {
          console.error(`Error syncing players for team ${team.name}:`, error);
          results.push({
            team_id: team.id,
            team_name: team.name,
            status: "error",
            error: error.message,
          });
        }
      }

      // Seed match_players with probable status for all squad players in this match
      try {
        // Only active squad for the current tournament season (avoid ambiguous joins)
        const tournament = await db("tournaments")
          .where({ id: match.tournament_id })
          .first();
        const seasonId = tournament?.season || null;

        const squadDbPlayers = await db("players as p")
          .select("p.id")
          .leftJoin("player_teams as pt", "p.id", "pt.player_id")
          .whereIn("pt.team_id", [match.team1_id, match.team2_id])
          .andWhere("pt.is_active", true)
          .modify((qb) => {
            if (seasonId) qb.andWhere("pt.season_id", seasonId);
          });

        const existing = await db("match_players")
          .select("player_id")
          .where({ match_id: match.id });
        const existingSet = new Set(existing.map((r) => Number(r.player_id)));

        const toInsert = squadDbPlayers
          .map((r) => Number(r.id))
          .filter((pid) => !existingSet.has(pid))
          .map((player_id) => ({
            match_id: match.id,
            player_id,
            is_playing_xi: false,
            is_substitute: false,
            is_captain: false,
            is_wicketkeeper: false,
            created_at: new Date(),
            updated_at: new Date(),
          }));

        if (toInsert.length) {
          await db("match_players").insert(toInsert);
          console.log(
            `Seeded ${toInsert.length} probable players for match ${match.id}`
          );
        } else {
          console.log(`No new probable players to seed for match ${match.id}`);
        }
      } catch (seedErr) {
        console.warn(
          "Warning: failed to seed match_players probable:",
          seedErr.message || seedErr
        );
      }

      return apiResponse.successResponseWithData(
        res,
        "Players synced successfully",
        { results }
      );
    } catch (error) {
      console.error("Error in syncMatchPlayers:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncMatchLineup(req, res) {
    try {
      const { matchId } = req.params;

      // Find match by DB id or SportMonks id
      const match = await db("matches")
        .where({ id: matchId })
        .orWhere({ sm_match_id: matchId })
        .first();

      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found");
      }

      // Fetch lineup from SportMonks
      const lineupResponse = await sportmonksService.getMatchLineup(
        match.sm_match_id
      );

      if (!lineupResponse.success) {
        return apiResponse.successResponseWithData(res, "No lineup available", {
          updated: false,
          message: lineupResponse.message,
        });
      }

      const lineupArr = lineupResponse.data || [];
      const lineupPlayerIds = lineupResponse.playerIds || [];

      if (!lineupArr.length) {
        return apiResponse.successResponseWithData(res, "No lineup available", {
          updated: false,
        });
      }

      // Map SM player ids to flags
      const smToFlags = new Map(
        lineupArr.map((p) => [
          String(p.id),
          {
            isSub: Boolean(p.lineup?.substitution),
            isCap: Boolean(p.lineup?.captain),
            isWk: Boolean(p.lineup?.wicketkeeper),
          },
        ])
      );

      // Resolve DB player ids from SM player ids
      const dbPlayers = await db("players")
        .select("id", "player_id")
        .whereIn("player_id", lineupPlayerIds);

      const lineupDbIds = dbPlayers.map((p) => Number(p.id));

      // Declare outside to use later in response
      let playersToUpdate = [];
      let playersToDeactivate = [];

      // Transaction for atomic operations
      await db.transaction(async (trx) => {
        const allExistingMatchPlayers = await trx("match_players")
          .where({ match_id: match.id })
          .select("player_id");

        const existingPlayerIds = allExistingMatchPlayers.map((p) =>
          Number(p.player_id)
        );

        // update only existing ones
        playersToUpdate = dbPlayers.filter((p) =>
          existingPlayerIds.includes(Number(p.id))
        );

        for (const player of playersToUpdate) {
          const flags = smToFlags.get(String(player.player_id)) || {
            isSub: false,
            isCap: false,
            isWk: false,
          };

          await trx("match_players")
            .where({ match_id: match.id, player_id: player.id })
            .update({
              is_playing_xi: !flags.isSub,
              is_substitute: flags.isSub,
              is_captain: flags.isCap,
              is_wicketkeeper: flags.isWk,
              updated_at: new Date(),
            });
        }

        // deactivate not in lineup
        playersToDeactivate = existingPlayerIds.filter(
          (id) => !lineupDbIds.includes(id)
        );

        if (playersToDeactivate.length) {
          await trx("match_players")
            .where({ match_id: match.id })
            .whereIn("player_id", playersToDeactivate)
            .update({
              is_playing_xi: false,
              is_substitute: false,
              is_captain: false,
              is_wicketkeeper: false,
              updated_at: new Date(),
            });
        }
      });

      return apiResponse.successResponseWithData(
        res,
        "Lineup synced successfully",
        {
          updated: true,
          existing_players_updated: playersToUpdate.length,
          new_players_skipped: dbPlayers.length - playersToUpdate.length,
          players_deactivated: playersToDeactivate.length,
        }
      );
    } catch (error) {
      console.error("Error in syncMatchLineup:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncUpcomingLineups(req, res) {
    try {
      const now = new Date();
      const windowMins = Number(req?.query?.window ?? 45);
      const until = new Date(now.getTime() + windowMins * 60000);

      const upcoming = await db("matches")
        .where("status", "=", "NS")
        .andWhere("start_time", ">", now)
        .andWhere("start_time", "<=", until)
        .select("id", "sm_match_id");

      let updated = 0;
      for (const m of upcoming) {
        try {
          const resp = await this.syncMatchLineup(
            { params: { matchId: m.id } },
            {
              status: () => ({ json: () => { } }),
              json: () => { },
            }
          );
          updated++;
        } catch (_e) { }
      }

      return apiResponse.successResponseWithData(
        res,
        "Upcoming lineups checked",
        {
          matches_checked: upcoming.length,
          attempted: updated,
        }
      );
    } catch (error) {
      console.error("Error in syncUpcomingLineups:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncJustStartedLineups(req, res) {
    try {
      const now = new Date();
      const pastMins = Number(req?.query?.past ?? 30);
      const since = new Date(now.getTime() - pastMins * 60000);
      const statuses = [
        "NS",
        "Not Started",
        "Live",
        "1st Innings",
        "2nd Innings",
        "3rd Innings",
      ];

      const justStarted = await db("matches")
        .whereIn("status", statuses)
        .andWhere("start_time", "<=", now)
        .andWhere("start_time", ">=", since)
        .select("id", "sm_match_id");

      let attempted = 0;
      for (const m of justStarted) {
        try {
          await this.syncMatchLineup(
            { params: { matchId: m.id } },
            {
              status: () => ({ json: () => { } }),
              json: () => { },
            }
          );
          attempted++;
        } catch (_e) { }
      }

      return apiResponse.successResponseWithData(
        res,
        "Just-started lineups checked",
        {
          matches_checked: justStarted.length,
          attempted,
        }
      );
    } catch (error) {
      console.error("Error in syncJustStartedLineups:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  //Lightweight status fetch (scoreboards endpoint also returns fixture status)
  async refreshJustStartedStatus(req, res) {
    try {
      const pastMins = Number(req?.query?.past ?? 12);
      const now = new Date();
      const since = new Date(now.getTime() - pastMins * 60000);

      const justStarted = await db("matches")
        .where("start_time", "<=", now)
        .andWhere("start_time", ">=", since)
        .whereIn("status", [
          "NS",
          "Delayed",
          "Not Started",
          "1st Innings",
          "2nd Innings",
          "3rd Innings",
          "4th Innings",
          "Stump Day 1",
          "Stump Day 2",
          "Stump Day 2",
          "Stump Day 4",
          "Innings Break",
          "Dinner",
          "Tea Break",
          "Live",
        ])
        .whereNotIn("status", [
          "Finished",
          "Completed",
          "Cancl",
          "Aban.",

          "Postp.",
        ])
        .select("id", "sm_match_id", "status");

      let checked = 0;
      let updated = 0;
      let errors = 0;

      const LIGHT_DELAY_MS = 400;

      for (const match of justStarted) {
        try {
          const resp = await sportmonksService.getFixtureScoreboards(
            match.sm_match_id
          );
          const providerStatus = resp?.data?.status;

          if (providerStatus && providerStatus !== match.status) {
            const updatePayload = {
              status: providerStatus,
              updated_at: new Date(),
            };

            await db("matches").where({ id: match.id }).update(updatePayload);
            updated++;
          }

          checked++;
          await new Promise((r) => setTimeout(r, LIGHT_DELAY_MS));
        } catch (_e) {
          errors++;
        }
      }

      return apiResponse.successResponseWithData(
        res,
        "Just-started statuses refreshed",
        {
          window_minutes: pastMins,
          checked,
          updated,
          errors,
        }
      );
    } catch (error) {
      console.error("Error in refreshJustStartedStatus:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getNewFixtureDetails(req, res) {
    try {
      // Only get today's matches to minimize API calls
      const matches = await db("matches")
        .where("sm_match_id", 65545)
        .select("id", "sm_match_id", "status", "start_time");

      let processed = 0;
      let skipped = 0;
      let scoreboardsUpdated = 0;
      const BASE_DELAY = 1500;

      for (const match of matches) {
        try {
          const matchId = match.sm_match_id;

          let response = await sportmonksService.getFixtureDetails(matchId);

          const result = await tournamentDbService.insertMatchAndPlayerStats(
            response.data,
            db
          );

          processed++;
        } catch (err) {
          console.error(`Error processing match ${match.id}:`, err);
          skipped++;
        }
      }

      return apiResponse.successResponseWithData(
        res,
        "Today's matches updated successfully",
        { processed, skipped, scoreboardsUpdated }
      );
    } catch (error) {
      console.error("Error in getFixtureDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  // Manually complete a contest & distribute winnings
  async completeContestManually(req, res) {
    try {
      const { contestId } = req.params;

      if (!contestId) {
        return apiResponse.ErrorResponse(res, "Contest ID is required");
      }

      const contest = await db("contests").where({ id: contestId }).first();
      if (!contest) {
        return apiResponse.ErrorResponse(res, "Contest not found");
      }

      // Match info
      const match = await db("matches").where({ id: contest.match_id }).first();
      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found for this contest");
      }

      // Leaderboard
      const leaderboard = await db("leaderboard")
        .where({ contestId: contest.id })
        .orderBy("rank", "asc");

      if (!leaderboard.length) {
        return apiResponse.successResponse(res, "No leaderboard found for contest");
      }

      // Already distributed check
      const existingTxns = await db("transactions")
        .where({ contest_id: contest.id, transactionType: "contest_winning" });

      if (existingTxns.length) {
        // Reverse old winnings
        for (const txn of existingTxns) {
          await db("wallet")
            .where({ user_id: txn.user_id })
            .decrement("balance", txn.amount);

          await db("users")
            .where({ id: txn.user_id })
            .decrement("wallet_balance", txn.amount);
        }

        // Remove old txns
        await db("transactions")
          .where({ contest_id: contest.id, transactionType: "contest_winning" })
          .del();
      }

      const winnings = contest.winnings || [];
      const team1 = await db("teams").where("id", match.team1_id).first();
      const team2 = await db("teams").where("id", match.team2_id).first();

      const matchTitle = team1 && team2 ? `${team1.short_name} vs ${team2.short_name}` : "Unknown Match";

      let totalDistributed = 0;
      let winnersCount = 0;

      for (const payoutTier of winnings) {
        const { from, to, price } = payoutTier;

        const winners = leaderboard.filter((row) => row.rank >= from && row.rank <= to);

        for (const winner of winners) {
          if (price > 0) {
            await db("wallet")
              .where({ user_id: winner.userId })
              .increment("balance", price);

            await db("users")
              .where({ id: winner.userId })
              .increment("wallet_balance", price);

            await db("transactions").insert({
              user_id: winner.userId,
              title: matchTitle,
              amount: price,
              transactionType: "contest_winning",
              status: "completed",
              currency: "BDT",
              contest_id: contest.id,
              mode: "MANUAL",
              created_at: new Date(),
              updated_at: new Date(),
            });

            totalDistributed += price;
            winnersCount++;
          }
        }
      }

      return apiResponse.successResponseWithData(
        res,
        `Contest ${contest.id} corrected successfully`,
        { contestId: contest.id, totalDistributed, winnersCount }
      );
    } catch (error) {
      console.error("Error in completeContestManually:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async randomizePlayerStats(req, res) {
    try {
      const players = await db("players").select("id");

      if (!players.length) {
        return apiResponse.successResponseWithData(
          res,
          SPORTMONKS.noPlayersFound,
          { totalPlayers: 0 }
        );
      }

      const creditOptions = [7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];
      const updateData = players.map((p) => {
        const randomCredits =
          creditOptions[Math.floor(Math.random() * creditOptions.length)];
        const randomPoints = Math.floor(Math.random() * 101); // 0 to 100

        return db("players")
          .where({ id: p.id })
          .update({
            credits: randomCredits,
            points: randomPoints,
            updated_at: new Date(),
          });
      });

      await Promise.all(updateData);

      return apiResponse.successResponseWithData(
        res,
        "Player stats randomized successfully",
        {
          totalPlayers: players.length,
        }
      );
    } catch (error) {
      console.error("Error in randomizePlayerStats:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = SportMonksController;
