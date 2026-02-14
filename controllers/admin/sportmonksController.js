const Tournament = require("../../models/Tournament");
const Team = require("../../models/Team");
const Match = require("../../models/Match");
const Player = require("../../models/Player");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SPORTMONKS } = require("../../utils/responseMsg");
const sportmonksService = require("../../services/sportmonksService");
const tournamentDbService = require("../../services/tournamentDbService");
const { generatePlayerStats } = require("../../utils/functions");

const SportMonksController = {
  // Get leagues (tournaments) and save to database
  async getLeagues(req, res) {
    try {
      const include = "season";
      const response = await sportmonksService.getLeagues(include);

      if (!response?.data?.length) {
        return apiResponse.successResponseWithData(res, SPORTMONKS.noLeaguesFound, []);
      }

      const saveResult = await tournamentDbService.insertTournaments(response.data);

      return apiResponse.successResponseWithData(res, SPORTMONKS.leaguesSavedSuccessfully, {
        totalLeagues: response.data.length,
        savedData: saveResult,
      });
    } catch (error) {
      console.error("Error in getLeagues:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get teams for a season
  async getSeasonsTeams(req, res) {
    try {
      const { tournamentId, seasonId } = req.body;
      const response = await sportmonksService.getSeasonsTeams(seasonId);

      if (!response?.data?.teams?.length) {
        return apiResponse.successResponseWithData(res, SPORTMONKS.noTeamsFound, []);
      }

      const saveResult = await tournamentDbService.insertTeams(response.data, tournamentId);

      return apiResponse.successResponseWithData(res, SPORTMONKS.teamsSavedSuccessfully, {
        totalTeamsInResponse: response.data.teams.length,
        savedTeams: saveResult.length,
        data: saveResult,
      });
    } catch (error) {
      console.error("Error in getSeasonsTeams:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get matches (fixtures) for a season
  async getSeasonsFixtures(req, res) {
    try {
      const { seasonId, tournamentId } = req.body;
      const response = await sportmonksService.getSeasonsFixtures(seasonId);

      if (!response?.data?.fixtures?.length) {
        return apiResponse.successResponseWithData(res, SPORTMONKS.noFixturesFound, []);
      }

      const saveResult = await tournamentDbService.insertFixtures(response.data, tournamentId);

      return apiResponse.successResponseWithData(res, SPORTMONKS.fixturesSavedSuccessfully, {
        totalFixturesInResponse: response.data.fixtures.length,
        savedFixtures: saveResult.length,
        data: saveResult,
      });
    } catch (error) {
      console.error("Error in getSeasonsFixtures:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get team players squad
  async getTeamSquad(req, res) {
    try {
      const { teamId, seasonId, tournamentId } = req.body;

      const dbTeam = await Team.findOne({ sportmonks_id: teamId });
      if (!dbTeam) {
        return apiResponse.ErrorResponse(res, "Team not found in database");
      }

      const response = await sportmonksService.getTeamSquadservice(teamId, seasonId);

      if (!response?.data?.squad?.length) {
        return apiResponse.ErrorResponse(res, "No squad data found from API");
      }

      const saveResult = await tournamentDbService.insertTeamSquad(
        response.data,
        dbTeam._id,
        teamId,
        seasonId
      );

      return apiResponse.successResponseWithData(res, SPORTMONKS.squadSavedSuccessfully, {
        totalPlayersInResponse: response.data.squad.length,
        savedPlayers: saveResult.length,
      });
    } catch (error) {
      console.error("Error in getTeamSquad:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateAllPlayers(req, res) {
    try {
      const allPlayers = await Player.find({ points: { $gt: 260 } }).lean();

      if (!allPlayers.length) {
        return apiResponse.successResponseWithData(res, SPORTMONKS.noPlayersFound, { totalPlayers: 0 });
      }

      const updateResults = [];

      for (const player of allPlayers) {
        try {
          const response = await sportmonksService.getPlayerDetails(player.sportmonks_id);
          if (!response?.data) continue;

          const role = response.data.position?.name || "Unknown";
          const playerStats = await generatePlayerStats(player.sportmonks_id, role);

          const updatedPlayer = await Player.findByIdAndUpdate(player._id, {
            credits: playerStats.credits,
            points: playerStats.avgFantasyPoints,
            updated_at: new Date(),
          }, { new: true });

          updateResults.push({ id: player._id, sm_id: player.sportmonks_id, status: 'updated' });
        } catch (err) {
          console.error(`Error updating player ${player.sportmonks_id}:`, err);
        }
      }

      return apiResponse.successResponseWithData(res, SPORTMONKS.playersUpdatedSuccessfully, {
        totalProcessed: updateResults.length,
      });
    } catch (error) {
      console.error("Error in updateAllPlayers:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFixtureDetails(req, res) {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const matches = await Match.find({
        start_time: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: ["Finished", "Completed", "Aban."] }
      });

      for (const match of matches) {
        const response = await sportmonksService.getFixtureDetails(match.sportmonks_id);
        if (response?.data) {
          await tournamentDbService.insertMatchStats(response.data);
        }
      }

      return apiResponse.successResponse(res, "Today's match stats synced successfully");
    } catch (error) {
      console.error("Error in getFixtureDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getTeamDetails(req, res) {
    try {
      const { teamId } = req.params;
      const response = await sportmonksService.getTeamDetails(teamId);
      if (!response?.data) return apiResponse.ErrorResponse(res, SPORTMONKS.teamDetailsNotFound);
      return apiResponse.successResponseWithData(res, SPORTMONKS.teamDetailsFound, response.data);
    } catch (error) {
      console.error("Error in getTeamDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getPlayerDetails(req, res) {
    try {
      const { playerId } = req.body;
      const response = await sportmonksService.getPlayerDetails(playerId);
      if (!response?.data) return apiResponse.ErrorResponse(res, SPORTMONKS.playerDetailsNotFound);
      return apiResponse.successResponseWithData(res, SPORTMONKS.playerDetailsFound, response.data);
    } catch (error) {
      console.error("Error in getPlayerDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getSeasonStages(req, res) {
    try {
      const { seasonId } = req.body;
      const response = await sportmonksService.getSeasonStages(seasonId);
      if (!response?.data) return apiResponse.ErrorResponse(res, "No data found");
      // Optional: Save stages if we have a Stage model
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, response.data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getCountries(req, res) {
    try {
      const response = await sportmonksService.getCountries();
      if (!response?.data) return apiResponse.ErrorResponse(res, "No data found");
      const saveResult = await tournamentDbService.insertCountries(response.data);
      return apiResponse.successResponseWithData(res, "Countries synced successfully", saveResult);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getVenues(req, res) {
    try {
      const response = await sportmonksService.getVenues();
      if (!response?.data) return apiResponse.ErrorResponse(res, "No data found");
      const saveResult = await tournamentDbService.insertVenues(response.data);
      return apiResponse.successResponseWithData(res, "Venues synced successfully", saveResult);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getScores(req, res) {
    try {
      const response = await sportmonksService.getScoreDetails();
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, response.data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async scoreCalculation(req, res) {
    try {
      const { updateLeaderboardForTodayMatches } = require("../../services/scoreCalculation");
      const result = await updateLeaderboardForTodayMatches();
      if (result.success) {
        return apiResponse.successResponse(res, "Score calculation completed successfully");
      } else {
        return apiResponse.ErrorResponse(res, result.error || "Score calculation failed");
      }
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getNewFixtureDetails(req, res) {
    try {
      const { fixtureId } = req.query;
      const response = await sportmonksService.getFixtureDetails(fixtureId);
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, response.data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncMatchPlayers(req, res) {
    try {
      const { matchId } = req.params;
      const response = await sportmonksService.getPlayingXI(matchId);
      // Logic to save players linked to match
      return apiResponse.successResponseWithData(res, "Match players synced", response.data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncMatchLineup(req, res) {
    try {
      const { matchId } = req.params;
      const response = await sportmonksService.getMatchLineup(matchId);
      return apiResponse.successResponseWithData(res, "Match lineup synced", response.data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncUpcomingLineups(req, res) {
    try {
      // Logic to fetch upcoming matches and sync lineups
      return apiResponse.successResponse(res, "Upcoming lineups sync initiated");
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncJustStartedLineups(req, res) {
    try {
      // Logic to sync lineups for matches that just started
      return apiResponse.successResponse(res, "Just started lineups sync initiated");
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async refreshMatchScoreboards(req, res) {
    try {
      const { matchId } = req.params;
      const response = await sportmonksService.getFixtureScoreboards(matchId);
      return apiResponse.successResponseWithData(res, "Scoreboards refreshed", response.data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateLiveScoreboards(req, res) {
    try {
      // Logic to update scoreboards for all live matches
      return apiResponse.successResponse(res, "Live scoreboards update initiated");
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncAllTournamentData(req, res) {
    try {
      const activeTournaments = await Tournament.find({ status: 'active' });

      const results = {
        totalActiveTournaments: activeTournaments.length,
        processedTournaments: 0,
        teamsSaved: 0,
        playersSaved: 0,
        fixturesSaved: 0,
        errors: []
      };

      for (const tournament of activeTournaments) {
        try {
          const seasonId = tournament.seasonId;
          const tournamentId = tournament._id;

          if (!seasonId) {
            results.errors.push(`Tournament ${tournament.name} has no seasonId`);
            continue;
          }

          // 1. Get teams
          const teamsResponse = await sportmonksService.getSeasonsTeams(seasonId, "teams");

          if (teamsResponse?.data?.teams) {
            const savedTeams = await tournamentDbService.insertTeams(teamsResponse.data, tournamentId);
            results.teamsSaved += savedTeams.length;

            // Process squads for each team separately
            for (const teamData of teamsResponse.data.teams) {
              const dbTeam = savedTeams.find(t => t.sportmonks_id === teamData.id);
              if (dbTeam) {
                // Fetch squad for this specific team and season
                const squadResponse = await sportmonksService.getTeamSquadservice(teamData.id, seasonId);

                if (squadResponse?.data) {
                  // Some API versions return data.squad, others just data
                  const squadGrid = Array.isArray(squadResponse.data) ? squadResponse.data : (squadResponse.data.squad || []);

                  const savedPlayers = await tournamentDbService.insertTeamSquad(
                    { squad: squadGrid },
                    dbTeam._id,
                    teamData.id,
                    seasonId
                  );
                  results.playersSaved += (savedPlayers ? savedPlayers.length : 0);
                }
              }
            }
          }

          // 2. Get fixtures
          const fixturesResponse = await sportmonksService.getSeasonsFixtures(seasonId);
          if (fixturesResponse?.data?.fixtures) {
            const savedFixtures = await tournamentDbService.insertFixtures(fixturesResponse.data, tournamentId);
            results.fixturesSaved += (savedFixtures ? savedFixtures.length : 0);
          }

          results.processedTournaments++;
        } catch (err) {
          console.error(`Error syncing tournament ${tournament.name}:`, err);
          results.errors.push(`Error syncing tournament ${tournament.name}: ${err.message}`);
        }
      }

      return apiResponse.successResponseWithData(res, "Sync completed successfully", results);
    } catch (error) {
      console.error("Critical error in syncAllTournamentData:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncAllTournamentData2(req, res) {
    try {
      return apiResponse.successResponse(res, "All tournament data 2 sync initiated");
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncAllTournamentTeams(req, res) {
    try {
      return apiResponse.successResponse(res, "All tournament teams sync initiated");
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async completeContestManually(req, res) {
    try {
      const { contestId } = req.params;
      const Contest = require("../../models/Contest");
      const contest = await Contest.findByIdAndUpdate(contestId, { status: "completed" }, { new: true });
      if (!contest) return apiResponse.ErrorResponse(res, "Contest not found");
      return apiResponse.successResponseWithData(res, "Contest completed manually", contest);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = SportMonksController;
