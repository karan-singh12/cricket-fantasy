const mongoose = require("mongoose");
const Tournament = require("../../models/Tournament");
const Team = require("../../models/Team");
const Match = require("../../models/Match");
const Player = require("../../models/Player");
const PlayerStat = require("../../models/PlayerStat");
const Country = require("../../models/Country");
const apiResponse = require("../../utils/apiResponse");
const { USER, ERROR, SUCCESS, TOURNAMENT, SPORTMONKS } = require("../../utils/responseMsg");
const sportmonksService = require("../../services/sportmonksService");
const tournamentDbService = require("../../services/tournamentDbService");

const tournamentController = {
  // Get all tournaments
  async getAllTournaments(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "asc",
        status = [],
      } = req.body;

      const filter = {};
      if (status.length > 0) {
        filter.status = { $in: status };
      }
      if (searchItem) {
        filter.name = { $regex: searchItem, $options: "i" };
      }

      const limit = parseInt(pageSize);
      const skip = Math.max(0, parseInt(pageNumber) - 1) * limit;

      const totalRecords = await Tournament.countDocuments(filter);
      const result = await Tournament.find(filter)
        .select("id name status start_date")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return res.json({
        success: true,
        data: {
          result,
          totalRecords,
          pageNumber: parseInt(pageNumber),
          pageSize: limit,
        },
      });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch tournaments",
        error: error.message,
      });
    }
  },

  // Get tournament by ID
  async getTournamentById(req, res) {
    try {
      const tournament = await Tournament.findById(req.params.id).lean();

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      res.json({
        success: true,
        data: tournament,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch tournament",
        error: error.message,
      });
    }
  },

  // Create tournament
  async createTournament(req, res) {
    try {
      const tournament = new Tournament(req.body);
      await tournament.save();

      res.status(201).json({
        success: true,
        message: "Tournament created successfully",
        data: tournament,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to create tournament",
        error: error.message,
      });
    }
  },

  // Update tournament
  async updateTournament(req, res) {
    try {
      const tournament = await Tournament.findByIdAndUpdate(
        req.params.id,
        { ...req.body },
        { new: true }
      );

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      res.json({
        success: true,
        message: "Tournament updated successfully",
        data: tournament,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update tournament",
        error: error.message,
      });
    }
  },

  // Delete tournament
  async deleteTournament(req, res) {
    try {
      const deleted = await Tournament.findByIdAndDelete(req.params.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      res.json({
        success: true,
        message: "Tournament deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete tournament",
        error: error.message,
      });
    }
  },

  // Get tournament teams
  async getTournamentTeams(req, res) {
    try {
      const tournament = await Tournament.findById(req.params.id).lean();
      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      // Teams linked to matches in this tournament? 
      // Original logic used `knex("teams").where("tournament_id", req.params.id)`
      // In Mongoose, Team might not have tournament_id. Match has tournament_id.
      // Let's assume teams are linked to matches.

      const matches = await Match.find({ tournament: req.params.id }).select('team1 team2').lean();
      const teamIds = new Set();
      matches.forEach(m => {
        if (m.team1) teamIds.add(m.team1.toString());
        if (m.team2) teamIds.add(m.team2.toString());
      });

      const teams = await Team.find({ _id: { $in: Array.from(teamIds) } }).sort({ name: 1 }).lean();

      const teamsWithCountry = await Promise.all(
        teams.map(async (team) => {
          let country = null;
          if (team.country_id) {
            country = await Country.findOne({ country_id: team.country_id }).lean();
          }
          return {
            ...team,
            country_name: country ? country.name : null,
            country_image: country ? country.image_path : null,
          };
        })
      );

      res.json({
        success: true,
        data: {
          tournament: tournament,
          teams: teamsWithCountry,
          api_metadata: tournament.metadata, // assuming metadata field
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch tournament teams",
        error: error.message,
      });
    }
  },

  // Get tournament matches
  async getTournamentMatches(req, res) {
    try {
      const tournament = await Tournament.findById(req.params.id).lean();
      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      const matches = await Match.find({ tournament: req.params.id })
        .populate('team1 team2')
        .sort({ start_time: 1 })
        .lean();

      const formattedMatches = matches.map(m => ({
        ...m,
        team1_name: m.team1?.name,
        team2_name: m.team2?.name,
        // venue_name handled if Match stores venue name or ref
      }));

      res.json({
        success: true,
        data: {
          tournament: tournament,
          matches: formattedMatches,
          api_metadata: tournament.metadata,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch tournament matches",
        error: error.message,
      });
    }
  },

  // Get a single team
  async getOneTeam(req, res) {
    try {
      const { id } = req.params;
      const team = await Team.findById(id).lean();

      if (!team) {
        return apiResponse.ErrorResponse(res, TOURNAMENT.teamNotFound);
      }

      let country = null;
      if (team.country_id) {
        country = await Country.findOne({ country_id: team.country_id }).lean();
      }

      const teamWithCountry = {
        ...team,
        country_name: country ? country.name : null,
        country_image: country ? country.image_path : null,
      };

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        teamWithCountry
      );
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Update a team
  async updateTeam(req, res) {
    try {
      const { id, metadata, country } = req.body;
      const updateData = {};
      if (metadata) updateData.metadata = metadata;
      if (country) updateData.country_id = country; // Map 'country' -> 'country_id'?

      if (req.file) {
        updateData.logo_url = req.file.path.replace(/\\/g, "/");
      }

      const team = await Team.findByIdAndUpdate(id, updateData, { new: true });

      if (!team) {
        return apiResponse.ErrorResponse(res, TOURNAMENT.teamNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        TOURNAMENT.teamUpdatedSuccessfully,
        team
      );
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMatchDetails(req, res) {
    try {
      const matchId = req.params.matchId;

      const match = await Match.findById(matchId).populate('team1 team2').lean();
      if (!match) return res.status(404).json({ success: false, message: "Match not found" });

      const playerStats = await PlayerStat.find({ match: matchId })
        .populate('player')
        .lean();

      // Group by team
      const teamStatsMap = {};
      playerStats.forEach((stat) => {
        const teamId = stat.player?.team?.toString();
        if (!teamId) return;

        if (!teamStatsMap[teamId]) {
          teamStatsMap[teamId] = {
            team_id: teamId,
            team_name: "", // will fill
            players: []
          };
        }
        teamStatsMap[teamId].players.push({
          player_name: stat.player?.name,
          profile_id: stat.player?.sportmonks_id,
          stats: stat
        });
      });

      res.json({
        success: true,
        data: {
          match,
          team_stats: Object.values(teamStatsMap),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch match details", error: error.message });
    }
  },

  async toggleTournamentStatus(req, res) {
    try {
      const tournament = await Tournament.findById(req.params.id);
      if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });

      // Assuming status is 'active'/'inactive' or Boolean
      // Logic used `!tournament.status` which suggests Boolean
      tournament.status = tournament.status === 'active' ? 'inactive' : 'active';
      await tournament.save();

      res.json({
        success: true,
        message: `Tournament status updated to ${tournament.status}`,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to toggle status", error: error.message });
    }
  },

  async testTournaments(req, res) {
    try {
      return res.json({ success: true, message: "Tournament test endpoint working" });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async syncTournaments(req, res) {
    try {
      const response = await sportmonksService.getLeagues();
      if (!response?.data?.length) {
        return apiResponse.successResponseWithData(res, SPORTMONKS.noLeaguesFound, []);
      }
      const saveResult = await tournamentDbService.insertTournaments(response.data);
      return apiResponse.successResponseWithData(res, SPORTMONKS.leaguesSavedSuccessfully, saveResult);
    } catch (error) {
      console.error("Error in syncTournaments:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncTournamentTeams(req, res) {
    try {
      const { id } = req.params;
      const tournament = await Tournament.findById(id);
      if (!tournament || !tournament.sportmonks_id) {
        return apiResponse.ErrorResponse(res, "Tournament or Season ID missing");
      }
      const response = await sportmonksService.getSeasonsTeams(tournament.sportmonks_id);
      const saveResult = await tournamentDbService.insertTeams(response.data, id);
      return apiResponse.successResponseWithData(res, SPORTMONKS.teamsSavedSuccessfully, saveResult);
    } catch (error) {
      console.error("Error in syncTournamentTeams:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async syncTournamentMatches(req, res) {
    try {
      const { id } = req.params;
      const tournament = await Tournament.findById(id);
      if (!tournament || !tournament.sportmonks_id) {
        return apiResponse.ErrorResponse(res, "Tournament or Season ID missing");
      }
      const response = await sportmonksService.getSeasonsFixtures(tournament.sportmonks_id);
      const saveResult = await tournamentDbService.insertFixtures(response.data, id);
      return apiResponse.successResponseWithData(res, SPORTMONKS.fixturesSavedSuccessfully, saveResult);
    } catch (error) {
      console.error("Error in syncTournamentMatches:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = tournamentController;
