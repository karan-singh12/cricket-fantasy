const axios = require("axios");

class SportMonksService {
  constructor() {
    this.baseURL = process.env.SPORTS_MONK_BASE_URL;
    this.apiKey = process.env.SPORTMONKS_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        "SPORTMONKS_API_KEY is not defined in environment variables"
      );
    }
  }

  // Fetch all leagues (Tournaments) from SportMonks API............
  // leagues = Tournaments
  async getLeagues(include = "season") {
    try {
      const response = await axios.get(`${this.baseURL}/leagues`, {
        params: {
          api_token: this.apiKey,
          include: include,
          per_page: 50,
        },
      });
      console.log(response.data)

      if (!response.data || !response.data.data) {
        console.error("Unexpected API response structure:", response.data);
        throw new Error("Unexpected API response structure");
      }


      return response.data;
    } catch (error) {
      console.error(
        "Error fetching leagues:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch leagues: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch all teams for a given season (Tournament) from SportMonks API.......
  async getSeasonsTeams(seasonId, include = "teams") {
    try {
      const seasonIdInt = Number(
        typeof seasonId === "object" && seasonId !== null
          ? seasonId.seasonId
          : seasonId
      );

      const response = await axios.get(
        `${this.baseURL}/seasons/${seasonIdInt}`,
        {
          params: {
            api_token: this.apiKey,
            include: include,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        `Error fetching seasons for league ${seasonId}:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch seasons: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch all fixtures (matches) for a given season (Tournament) from SportMonks API.........
  async getSeasonsFixtures(seasonId, include = "fixtures") {
    try {
      const seasonIdInt = Number(
        typeof seasonId === "object" && seasonId !== null
          ? seasonId.seasonId
          : seasonId
      );

      const response = await axios.get(
        `${this.baseURL}/seasons/${seasonIdInt}`,
        {
          params: {
            api_token: this.apiKey,
            include: include,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        `Error fetching seasons for league ${seasonId}:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch seasons: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch squad (Team Players) for a team in a season (Tournament team) from SportMonks API (squad = Team Players) ..........
  async getTeamSquadservice(teamId, seasonId) {

    try {
      const seasonIdInt = Number(
        typeof seasonId === "object" && seasonId !== null
          ? seasonId.seasonId
          : seasonId
      );
      const teamIdInt = Number(
        typeof teamId === "object" && teamId !== null ? teamId.teamId : teamId
      );

      const response = await axios.get(
        `${this.baseURL}/teams/${teamIdInt}/squad/${seasonIdInt}`,
        {
          params: {
            api_token: this.apiKey,
          },
        }
      );


      return response.data;
    } catch (error) {
      console.error(
        `Error fetching squad for team ${teamId}, season ${seasonId}:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch team squad: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch details for a specific team from SportMonks API - SKIP
  async getTeamDetails(teamId) {
    try {
      const response = await axios.get(`${this.baseURL}/teams/${teamId}`, {
        params: {
          api_token: this.apiKey,
          include: "country,venue,squad.player",
        },
      });

      return response.data;
    } catch (error) {
      console.error(
        `Error fetching team ${teamId} details:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch team details: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch details for a specific player from SportMonks API - SKIP
  async getPlayerDetails(playerId) {
    try {
      const response = await axios.get(`${this.baseURL}/players/${playerId}`, {
        params: {
          api_token: this.apiKey,
          include: "career",
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        `Error fetching player ${playerId} details:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch player details: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch all stages for a given season (Tournament) from SportMonks API......
  async getSeasonStages(seasonId) {
    try {
      const seasonIdInt = Number(seasonId);
      const response = await axios.get(
        `${this.baseURL}/seasons/${seasonIdInt}`,
        {
          params: {
            api_token: this.apiKey,
            include: "stages",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        `Error fetching stages for season ${seasonId}:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch season stages: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch all countries from SportMonks API..........
  async getCountries() {
    try {
      const response = await axios.get(`${this.baseURL}/countries`, {
        params: {
          api_token: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        `Error fetching stages for season ${seasonId}:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch season stages: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Fetch all venues from SportMonks API.......
  async getVenues() {
    try {
      const response = await axios.get(`${this.baseURL}/venues`, {
        params: {
          api_token: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        `Error fetching stages for season ${seasonId}:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch season stages: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  // getFixturesDetails
  async getFixtureDetails(fixtureId) {
    try {
      const response = await axios.get(`${this.baseURL}/fixtures/${fixtureId}`, {
        params: {
          api_token: this.apiKey,
          include: "scoreboards,batting.wicket,bowling,balls.score",
        },
      });

      return response.data;
    } catch (error) {
      // Prepare a new error object with status
      const err = new Error(`Error fetching fixture ${fixtureId} details: ${error.response?.data || error.message}`);
      err.status = error.response?.status || 500;

      console.error(err.message);
      throw err;
    }
  }



  // Lightweight fetch for only scoreboards (fast, less rate pressure)
  async getFixtureScoreboards(fixtureId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/fixtures/${fixtureId}`,
        {
          params: {
            api_token: this.apiKey,
            include: "scoreboards",
          },
        }
      );
      return response.data;
    } catch (error) {
      const payload = error.response?.data || error.message;
      const msg =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      const err = new Error(`Failed to fetch scoreboards: ${msg}`);
      err.status = error.response?.status;
      throw err;
    }
  }

  async getScoreDetails() {
    try {
      const response = await axios.get(`${this.baseURL}/scores`, {
        params: {
          api_token: this.apiKey,
        },
      });



      return response.data;
    } catch (error) {
      console.error(
        `Error fetching scores details:`,
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch player details: ${error.response?.data?.message || error.message
        }`
      );
    }
  }

  async getPlayingXI(matchId) {
    try {

      // Fetch fixture with lineup data using the correct include parameter
      const response = await axios.get(`${this.baseURL}/fixtures/${matchId}`, {
        params: {
          api_token: this.apiKey,
          include: "lineup", // The correct include parameter for lineup data
        },
      });

      // Check if we got lineup data
      const lineupData = response.data?.data?.lineup || [];
      if (lineupData.length > 0) {
        console.log(
          `Found ${lineupData.length} players in lineup for match ${matchId}`
        );
        return { data: lineupData };
      } else {
        console.log(
          `No lineup data available for match ${matchId}, falling back to team squads`
        );
      }

      // If no lineup data, get the fixture details to get team IDs
      const fixtureResponse = await axios.get(
        `${this.baseURL}/fixtures/${matchId}`,
        {
          params: {
            api_token: this.apiKey,
          },
        }
      );

      const fixture = fixtureResponse.data?.data;
      if (!fixture) {
        throw new Error("Fixture data not found");
      }

      // Get team IDs from the fixture
      const localTeamId = fixture.localteam_id;
      const visitorTeamId = fixture.visitorteam_id;

      // Get squads for both teams
      const [localSquad, visitorSquad] = await Promise.all([
        this.getTeamSquadservice(localTeamId, fixture.season_id),
        this.getTeamSquadservice(visitorTeamId, fixture.season_id),
      ]);

      // Combine squads from both teams
      const combinedSquad = [
        ...(localSquad.data?.squad || []),
        ...(visitorSquad.data?.squad || []),
      ];

      console.log(
        `Falling back to full squad: ${combinedSquad.length} players`
      );
      return { data: combinedSquad };
    } catch (error) {
      console.error(
        `Error fetching playing XI for match ${matchId}:`,
        error.response?.data || error.message
      );
      console.error(`Request URL: ${this.baseURL}/fixtures/${matchId}`);
      console.error(`Status code: ${error.response?.status}`);
      throw new Error(
        `Failed to fetch playing XI: ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
    }
  }

  // New method to get only the lineup players for a match
  async getMatchLineup(matchId) {
    try {
      console.log(`Fetching lineup players for match ${matchId}`);
      const response = await axios.get(`${this.baseURL}/fixtures/${matchId}`, {
        params: {
          api_token: this.apiKey,
          include: "lineup",
        },
      });

      const lineupData = response.data?.data?.lineup || [];
      if (lineupData.length > 0) {
        console.log(
          `Found ${lineupData.length} players in lineup for match ${matchId}`
        );

        // Extract player IDs from lineup
        const playerIds = lineupData.map((player) => player.id);
        return {
          success: true,
          data: lineupData,
          playerIds: playerIds,
        };
      } else {
        console.log(`No lineup data available for match ${matchId}`);
        return {
          success: false,
          message: "No lineup data available",
        };
      }
    } catch (error) {
      console.error(
        `Error fetching lineup for match ${matchId}:`,
        error.response?.data || error.message
      );
      return {
        success: false,
        message: "Error fetching lineup data",
        error: error.message,
      };
    }
  }
  async getPlayerCareerStats(playerId) {
    try {
      const response = await axios.get(`${this.baseURL}/players/${playerId}`, {
        params: {
          api_token: this.apiKey,
          include: "career.season",
        },
      });

      const careerData = response.data.data.career || [];
      const relevantFormats = ["ODI", "T20", "T20I", "Test/5day", "List A"];

      const FiveYearsAgo = new Date();
      FiveYearsAgo.setFullYear(FiveYearsAgo.getFullYear() - 5);

      // Filter career data for relevant formats and last 5 years
      const filteredData = careerData.filter(
        (season) =>
          relevantFormats.includes(season.type) &&
          new Date(season.updated_at) >= FiveYearsAgo
      );

      // Sort by updated_at descending
      filteredData.sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
      );

      // Limit to 10 most recent
      return filteredData.slice(0, 10);
    } catch (err) {
      console.error(
        `Error fetching career stats for player ${playerId}:`,
        err.message
      );
      return [];
    }
  }
}

module.exports = new SportMonksService();
