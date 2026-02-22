const { error } = require("winston");
const { knex } = require("../../config/database");
const goalserveService = require("../../services/goalserveService");
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator } = require("../../utils/functions");
const { USER, ERROR, SUCCESS, TOURNAMENT } = require("../../utils/responseMsg");

const tournamentController = {
  // Get all tournaments
  async getAllTournaments(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        sortBy = "id",
        sortOrder = "asc",
        status = [],
      } = req.body;



      pageNumber = Math.max(0, pageNumber - 1);

      let query = knex("tournaments");

      if (status.length > 0) {
        query.andWhere((qb) => qb.whereIn("status", status));
      }

      if (searchItem) {
        query.andWhere((builder) =>
          builder.whereILike("name", `%${searchItem}%`)
        );
      }

      const totalRecords = await query.clone().count().first();

      const result = await query
        .select("id", "name", "status", "start_date")
        .orderBy(sortBy, sortOrder)
        .limit(pageSize)
        .offset(pageSize * pageNumber);

      const formattedResult = result.map((t) => ({
        ...t,
        status: !!t.status,
      }));

      return res.json({
        success: true,
        data: {
          result: formattedResult,
          totalRecords: parseInt(totalRecords.count),
          pageNumber: pageNumber + 1,
          pageSize,
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
      const tournament = await knex("tournaments")
        .where("id", req.params.id)
        .first();

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      res.json({
        success: true,
        data: {
          ...tournament,
          status: !!tournament.status,
        },
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
      const [tournament] = await knex("tournaments")
        .insert({
          ...req.body,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        })
        .returning("*");

      res.status(201).json({
        success: true,
        message: "Tournament created successfully",
        data: {
          ...tournament,
          status: !!tournament.status,
        },
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
      const [tournament] = await knex("tournaments")
        .where("id", req.params.id)
        .update({
          ...req.body,
          updated_at: knex.fn.now(),
        })
        .returning("*");

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      res.json({
        success: true,
        message: "Tournament updated successfully",
        data: {
          ...tournament,
          status: !!tournament.status,
        },
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
      const deleted = await knex("tournaments")
        .where("id", req.params.id)
        .del();

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
      const tournament = await knex("tournaments")
        .where("id", req.params.id)
        .first();

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }


      const metadata = tournament.metadata;

      const teamsRaw = await knex("teams")
        .select("teams.*")
        .where("tournament_id", req.params.id)
        .orderBy("teams.name", "asc");

      const teams = await Promise.all(
        teamsRaw.map(async (team) => {
          let meta = team.metadata;
          if (typeof meta === "string") {
            try {
              meta = JSON.parse(meta);
            } catch (e) {
              meta = {};
            }
          }
          let countryId = null;
          if (meta && meta.country_id) {
            countryId = meta.country_id;
          } else if (team.country && !isNaN(Number(team.country))) {
            countryId = Number(team.country);
          }
          let country = null;
          if (countryId) {
            country = await knex("countries")
              .where("country_id", countryId)
              .first();
          }
          return {
            ...team,
            metadata: meta,
            country_name: country ? country.name : null,
            country_image: country ? country.image_path : null,
          };
        })
      );

      res.json({
        success: true,
        data: {
          tournament: {
            ...tournament,
            status: !!tournament.status,
          },
          teams: teams,
          api_metadata: metadata,
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
      const tournament = await knex("tournaments")
        .where("id", req.params.id)
        .first();

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      let metadata = tournament.metadata;
      if (typeof metadata === "string") {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.log("error", error.message);
          apiResponse.ErrorResponse(res, "Failed to Parse metadata");
        }
      }
      const matches = await knex("matches")
        .select(
          "matches.*",
          "t1.name as team1_name",
          "t2.name as team2_name",
          "venues.name as venue_name"
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .leftJoin("venues", "matches.venue", "venues.id")
        .where("matches.tournament_id", req.params.id)
        .orderBy("matches.start_time", "asc");


      res.json({
        success: true,
        data: {
          tournament: {
            ...tournament,
            status: !!tournament.status,
          },
          matches: matches,
          api_metadata: metadata,
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

      const team = await knex("teams").where({ id }).first();

      if (!team) {
        return apiResponse.ErrorResponse(res, TOURNAMENT.teamNotFound);
      }

      let meta = team.metadata;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch (e) {
          meta = {};
        }
      }
      let countryId = null;
      if (meta && meta.country_id) {
        countryId = meta.country_id;
      } else if (team.country && !isNaN(Number(team.country))) {
        countryId = Number(team.country);
      }
      let country = null;
      if (countryId) {
        country = await knex("countries")
          .where("country_id", countryId)
          .first();
      }

      const teamWithCountry = {
        ...team,
        metadata: meta,
        country_name: country ? country.name : null,
        country_image: country ? country.image_path : null,
      };

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        teamWithCountry
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Update a team (e.g., logo_url)
  async updateTeam(req, res) {
    try {
      const { id, metadata, country } = req.body;

      const team = await knex("teams").where({ id }).first();

      if (!team) {
        return apiResponse.ErrorResponse(res, TOURNAMENT.teamNotFound);
      }
      const updateData = {
        updated_at: knex.fn.now(),
      };

      if (metadata) updateData.metadata = metadata;
      if (country) updateData.country = country;
      if (req.file) {
        updateData.logo_url = req.file.path.replace(/\\/g, "/");
      }

      const [data] = await knex("teams")
        .where({ id })
        .update(updateData)
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        TOURNAMENT.teamUpdatedSuccessfully,
        data
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMatchDetails(req, res) {
    try {
      const matchId = req.params.matchId;

      // Get match details with teams
      const match = await knex("matches")
        .select(
          "matches.*",
          "t1.name as team1_name",
          "t2.name as team2_name",
          "v.name as victory_team_name"
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .leftJoin("teams as v", "matches.victory_team_id", "v.id")
        .where("matches.id", matchId)
        .first();

      if (!match) {
        return res.status(404).json({
          success: false,
          message: "Match not found",
        });
      }

      // Get player statistics for both teams
      const playerStats = await knex("player_stats")
        .select(
          "player_stats.*",
          "players.name as player_name",
          "players.player_id as profile_id",
          "teams.name as team_name"
        )
        .join("players", "player_stats.player_id", "players.id")
        .join("teams", "players.team_id", "teams.id")
        .where("player_stats.match_id", matchId)
        .orderBy("teams.name", "asc")
        .orderBy("players.name", "asc");

      // Get match statistics for both teams
      const matchStats = await knex("match_stats")
        .select(
          "match_stats.*",
          "players.name as player_name",
          "players.player_id as profile_id",
          "teams.name as team_name"
        )
        .join("players", "match_stats.player_id", "players.id")
        .join("teams", "match_stats.team_id", "teams.id")
        .where("match_stats.match_id", matchId)
        .orderBy("teams.name", "asc")
        .orderBy("players.name", "asc");

      // Group player stats by team
      const teamStats = {};
      playerStats.forEach((stat) => {
        if (!teamStats[stat.team_name]) {
          teamStats[stat.team_name] = {
            team_name: stat.team_name,
            players: [],
          };
        }
        teamStats[stat.team_name].players.push({
          player_name: stat.player_name,
          profile_id: stat.profile_id,
          stats: {
            runs_scored: stat.runs_scored,
            balls_faced: stat.balls_faced,
            fours: stat.fours,
            sixes: stat.sixes,
            strike_rate: stat.strike_rate,
            wickets: stat.wickets,
            overs_bowled: stat.overs_bowled,
            runs_conceded: stat.runs_conceded,
            maidens: stat.maidens,
            catches: stat.catches,
            stumpings: stat.stumpings,
            run_outs: stat.run_outs,
            fantasy_points: stat.fantasy_points,
            metadata: stat.metadata,
          },
        });
      });

      res.json({
        success: true,
        data: {
          match: {
            id: match.id,
            team1: match.team1_name,
            team2: match.team2_name,
            victory_team: match.victory_team_name,
            venue: match.venue,
            start_time: match.start_time,
            status: match.status,
            toss: match.toss,
            man_of_match: match.man_of_match,
            metadata: match.metadata,
          },
          team_stats: Object.values(teamStats),
        },
      });
    } catch (error) {
      console.error("Error fetching match details:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch match details",
        error: error.message,
      });
    }
  },

  // Toggle tournament status (active/inactive)
  async toggleTournamentStatus(req, res) {
    try {
      const tournament = await knex("tournaments")
        .where("id", req.params.id)
        .first();

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      const newStatus = !tournament.status;

      const [updatedTournament] = await knex("tournaments")
        .where("id", req.params.id)
        .update({
          status: newStatus,
          updated_at: knex.fn.now(),
        })
        .returning("*");

      res.json({
        success: true,
        message: `Tournament status ${newStatus ? "Activate" : "Deactivate"}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to toggle tournament status",
        error: error.message,
      });
    }
  },
  //! SYNC FUNCTIONS
  // Sync tournament teams
  async syncTournamentTeams(req, res) {
    const trx = await knex.transaction();

    try {
      const tournament = await trx("tournaments")
        .where("tournament_id", req.params.id)
        .first();

      if (!tournament) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      const metadata = tournament.metadata;

      // Fetch teams from API using the squads_file path
      const teamsData = await goalserveService.getTournamentSquads(
        metadata.squads_file
      );
      // console.log('Raw Teams data:', JSON.stringify(teamsData, null, 2));

      // Process and store teams and players
      const processedTeams = [];
      const processedPlayers = [];

      // Check if we have the expected data structure
      if (teamsData.squads && teamsData.squads.category) {
        const category = teamsData.squads.category;
        // console.log('Category data:', JSON.stringify(category, null, 2));

        // Process each team
        if (category.team && Array.isArray(category.team)) {
          // console.log('Number of teams to process:', category.team.length);

          // Process teams in parallel
          await Promise.all(
            category.team.map(async (teamData) => {
              try {
                // console.log('Processing team:', teamData.name);

                // Insert or update team
                const [savedTeam] = await trx("teams")
                  .insert({
                    name: teamData.name,
                    short_name: teamData.name
                      .split(" ")
                      .map((word) => word[0])
                      .join(""),
                    tournament_id: tournament.id,
                    // metadata: JSON.stringify({
                    //     api_id: teamData.id,
                    //     raw_data: teamData
                    // }),
                    created_at: knex.fn.now(),
                    updated_at: knex.fn.now(),
                  })
                  // .onConflict(['name', 'tournament_id'])
                  // .merge()
                  .returning("*");

                if (!savedTeam) {
                  throw new Error(`Failed to save team: ${teamData.name}`);
                }

                // console.log('Saved team:', savedTeam);
                processedTeams.push(savedTeam);

                // Process players for this team
                if (teamData.player && Array.isArray(teamData.player)) {
                  console.log(
                    `Processing ${teamData.player.length} players for team ${teamData.name}`
                  );

                  // Process players in parallel
                  const playerPromises = teamData.player.map(
                    async (playerData) => {
                      try {
                        // console.log('Processing player:', playerData.id);

                        const [savedPlayer] = await trx("players")
                          .insert({
                            name: playerData.id,
                            player_id: playerData.name,
                            team_id: savedTeam.id,
                            role: playerData.role || "Player",
                            // metadata: JSON.stringify({
                            //     odi: playerData.odi === 'True',
                            //     t20: playerData.t20 === 'True',
                            //     test: playerData.test === 'True',
                            //     raw_data: playerData
                            // }),
                            created_at: knex.fn.now(),
                            updated_at: knex.fn.now(),
                          })
                          // .onConflict(['name', 'team_id'])
                          // .merge()
                          .returning("*");

                        if (!savedPlayer) {
                          throw new Error(
                            `Failed to save player: ${playerData.id}`
                          );
                        }

                        // console.log('Saved player:', savedPlayer);
                        processedPlayers.push(savedPlayer);
                      } catch (playerError) {
                        console.error("Error saving player:", playerError);
                        console.error("Player data:", playerData);
                        throw playerError; // Re-throw to trigger transaction rollback
                      }
                    }
                  );

                  await Promise.all(playerPromises);
                } else {
                  console.log("No players found for team:", teamData.name);
                }
              } catch (teamError) {
                console.error("Error saving team:", teamError);
                console.error("Team data:", teamData);
                throw teamError; // Re-throw to trigger transaction rollback
              }
            })
          );
        } else {
          console.log("No teams found in category");
        }
      } else {
        console.log("Unexpected data structure:", Object.keys(teamsData));
        throw new Error("Invalid data structure received from API");
      }

      // Commit the transaction
      await trx.commit();

      // Verify the data was saved
      const savedTeams = await knex("teams")
        .where("tournament_id", tournament.id)
        .select("*");

      const savedPlayers = await knex("players")
        .whereIn(
          "team_id",
          savedTeams.map((team) => team.id)
        )
        .select("*");

      // console.log('Verified saved teams:', savedTeams.length);
      // console.log('Verified saved players:', savedPlayers.length);

      res.json({
        success: true,
        message: "Tournament teams and players synchronized successfully",
        data: {
          tournament: {
            ...tournament,
            status: !!tournament.status,
          },
          teams: savedTeams,
          players: savedPlayers,
        },
      });
    } catch (error) {
      // Rollback the transaction on error
      await trx.rollback();
      console.error("Sync tournament teams error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to synchronize tournament teams",
        error: error.message,
      });
    }
  },

  // Helper function to process a team
  async processTeam(trx, teamData, tournamentId, processedTeams) {
    const teamKey = `${teamData.id}-${tournamentId}`;

    if (processedTeams.has(teamKey)) {
      return processedTeams.get(teamKey);
    }

    const [savedTeam] = await trx("teams")
      .insert({
        name: teamData.name,
        tournament_id: tournamentId,
        metadata: JSON.stringify({
          api_id: teamData.id,
          raw_data: teamData,
        }),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .returning("*");

    processedTeams.set(teamKey, savedTeam);
    return savedTeam;
  },

  // Helper function to process team players
  async processTeamPlayers(trx, teamData, teamId, matchId, processedPlayers) {
    if (!teamData || !teamData.player || !Array.isArray(teamData.player)) {
      return;
    }

    for (const player of teamData.player) {
      try {
        if (!player || !player.name || !player.profileid) {
          continue;
        }

        const playerKey = `${player.profileid}-${teamId}`;
        let savedPlayer;

        if (processedPlayers.has(playerKey)) {
          savedPlayer = processedPlayers.get(playerKey);
        } else {
          // First check if player already exists with this profileid
          savedPlayer = await trx("players")
            .where("player_id", player.profileid)
            .first();

          if (!savedPlayer) {
            // Create new player if not found
            [savedPlayer] = await trx("players")
              .insert({
                name: player.name,
                team_id: teamId,
                player_id: player.profileid,
                metadata: JSON.stringify({
                  api_id: player.profileid,
                  raw_data: player,
                }),
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
              })
              .returning("*");
          } else {
            // Update existing player's team if needed
            if (savedPlayer.team_id !== teamId) {
              [savedPlayer] = await trx("players")
                .where("id", savedPlayer.id)
                .update({
                  team_id: teamId,
                  updated_at: knex.fn.now(),
                })
                .returning("*");
            }
          }

          processedPlayers.set(playerKey, savedPlayer);
        }

        // Save player match statistics in match_stats table
        await trx("match_stats")
          .insert({
            match_id: matchId,
            player_id: savedPlayer.id,
            team_id: teamId,
            role: "player",
            runs: 0,
            balls_faced: 0,
            fours: 0,
            sixes: 0,
            strike_rate: 0,
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
            metadata: JSON.stringify({
              lineup_data: player,
              is_playing_xi: player.c === "1",
              is_substitute: player.c === "0",
            }),
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          })
          .onConflict(["match_id", "player_id"])
          .merge();

        // Save player statistics in player_stats table
        await trx("player_stats")
          .insert({
            match_id: matchId,
            player_id: savedPlayer.id,
            runs_scored: 0,
            balls_faced: 0,
            fours: 0,
            sixes: 0,
            wickets: 0,
            overs_bowled: 0,
            runs_conceded: 0,
            maidens: 0,
            catches: 0,
            stumpings: 0,
            run_outs: 0,
            fantasy_points: 0,
            metadata: JSON.stringify({
              lineup_data: player,
              is_playing_xi: player.c === "1",
              is_substitute: player.c === "0",
            }),
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          })
          .onConflict(["match_id", "player_id"])
          .merge();
      } catch (error) {
        console.error("Error processing player:", error);
        console.error("Player data:", JSON.stringify(player, null, 2));
        // Continue with next player
      }
    }
  },

  // Helper function to process innings statistics
  async processInningsStats(trx, matchData, matchId, processedPlayers) {
    try {
      if (!matchData.inning || !Array.isArray(matchData.inning)) {
        return;
      }

      // First, ensure all players from innings exist in the database
      const allPlayers = new Set();
      const teamPlayers = new Map(); // Map to store team assignments

      // Get the teams from the match data
      const localTeam = await trx("teams")
        .where("name", matchData.localteam.name)
        .first();

      const visitorTeam = await trx("teams")
        .where("name", matchData.visitorteam.name)
        .first();

      if (!localTeam || !visitorTeam) {
        console.error("Teams not found:", {
          local: matchData.localteam.name,
          visitor: matchData.visitorteam.name,
        });
        return;
      }

      // Collect all player profileids from innings and their team assignments
      for (const inning of matchData.inning) {
        const teamType = inning.team; // 'localteam' or 'visitorteam'
        const team = teamType === "localteam" ? localTeam : visitorTeam;

        if (inning && inning.batsmanstats && inning.batsmanstats.player) {
          inning.batsmanstats.player.forEach((batsman) => {
            if (batsman && batsman.profileid) {
              allPlayers.add({
                profileid: batsman.profileid,
                name: batsman.batsman,
                role: "batsman",
              });
              teamPlayers.set(batsman.profileid, team.id);
            }
          });
        }
        if (inning && inning.bowlers && inning.bowlers.player) {
          inning.bowlers.player.forEach((bowler) => {
            if (bowler && bowler.profileid) {
              allPlayers.add({
                profileid: bowler.profileid,
                name: bowler.bowler,
                role: "bowler",
              });
              teamPlayers.set(bowler.profileid, team.id);
            }
          });
        }
      }

      // Create players if they don't exist
      for (const playerData of allPlayers) {
        try {
          let player = await trx("players")
            .where("player_id", playerData.profileid)
            .first();

          if (!player) {
            // Get the team ID for this player
            const teamId = teamPlayers.get(playerData.profileid);
            if (!teamId) {
              console.error("No team found for player:", playerData);
              continue;
            }

            [player] = await trx("players")
              .insert({
                name: playerData.name,
                player_id: playerData.profileid,
                team_id: teamId,
                role: playerData.role,
                metadata: JSON.stringify({
                  api_id: playerData.profileid,
                  raw_data: playerData,
                }),
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
              })
              .returning("*");
          }
        } catch (error) {
          console.error("Error creating player:", error);
          console.error("Player data:", JSON.stringify(playerData, null, 2));
          continue; // Skip this player and continue with others
        }
      }

      // Now process the statistics
      for (const inning of matchData.inning) {
        const teamType = inning.team;
        const team = teamType === "localteam" ? localTeam : visitorTeam;

        // Process batting statistics
        if (inning.batsmanstats && inning.batsmanstats.player) {
          for (const batsman of inning.batsmanstats.player) {
            try {
              if (!batsman || !batsman.profileid) continue;

              // Find the player in our database
              const player = await trx("players")
                .where("player_id", batsman.profileid)
                .first();

              if (!player) continue;

              // Save batting statistics in match_stats
              await trx("match_stats")
                .insert({
                  match_id: matchId,
                  player_id: player.id,
                  team_id: team.id,
                  role: "batsman",
                  runs: batsman.r ? parseInt(batsman.r) : 0,
                  balls_faced: batsman.b ? parseInt(batsman.b) : 0,
                  fours: batsman.s4 ? parseInt(batsman.s4) : 0,
                  sixes: batsman.s6 ? parseInt(batsman.s6) : 0,
                  strike_rate: batsman.sr ? parseFloat(batsman.sr) : 0,
                  dismissal_type: batsman.dismissal_type || null,
                  dismissal_bowler: batsman.dismissal_bowler || null,
                  dismissal_fielders: batsman.dismissal_fielders || null,
                  batting_status: batsman.status || null,
                  metadata: JSON.stringify(batsman),
                  created_at: knex.fn.now(),
                  updated_at: knex.fn.now(),
                })
                .onConflict(["match_id", "player_id"])
                .merge();

              // Save batting statistics in player_stats
              await trx("player_stats")
                .insert({
                  match_id: matchId,
                  player_id: player.id,
                  runs_scored: batsman.r ? parseInt(batsman.r) : 0,
                  balls_faced: batsman.b ? parseInt(batsman.b) : 0,
                  fours: batsman.s4 ? parseInt(batsman.s4) : 0,
                  sixes: batsman.s6 ? parseInt(batsman.s6) : 0,
                  strike_rate: batsman.sr ? parseFloat(batsman.sr) : 0,
                  catches: 0,
                  stumpings: 0,
                  run_outs: 0,
                  metadata: JSON.stringify(batsman),
                  created_at: knex.fn.now(),
                  updated_at: knex.fn.now(),
                })
                .onConflict(["match_id", "player_id"])
                .merge();
            } catch (error) {
              console.error("Error saving batting stats:", error);
              console.error("Batsman data:", JSON.stringify(batsman, null, 2));
              continue; // Skip this batsman and continue with others
            }
          }
        }

        // Process bowling statistics
        if (inning.bowlers && inning.bowlers.player) {
          for (const bowler of inning.bowlers.player) {
            try {
              if (!bowler || !bowler.profileid) continue;

              // Find the player in our database
              const player = await trx("players")
                .where("player_id", bowler.profileid)
                .first();

              if (!player) continue;

              // Parse overs as decimal
              const overs = bowler.o ? parseFloat(bowler.o) : 0;
              const maidens = bowler.m ? parseInt(bowler.m) : 0;
              const runs = bowler.r ? parseInt(bowler.r) : 0;
              const wickets = bowler.w ? parseInt(bowler.w) : 0;
              const economy = bowler.er ? parseFloat(bowler.er) : 0;
              const dots = bowler.dots ? parseInt(bowler.dots) : 0;
              const wides = bowler.wd ? parseInt(bowler.wd) : 0;
              const noBalls = bowler.nb ? parseInt(bowler.nb) : 0;

              // Save bowling statistics in match_stats
              await trx("match_stats")
                .insert({
                  match_id: matchId,
                  player_id: player.id,
                  team_id: team.id,
                  role: "bowler",
                  overs_bowled: overs,
                  maidens: maidens,
                  runs_conceded: runs,
                  wickets: wickets,
                  economy_rate: economy,
                  dots: dots,
                  wides: wides,
                  no_balls: noBalls,
                  metadata: JSON.stringify(bowler),
                  created_at: knex.fn.now(),
                  updated_at: knex.fn.now(),
                })
                .onConflict(["match_id", "player_id"])
                .merge();

              // Save bowling statistics in player_stats
              await trx("player_stats")
                .insert({
                  match_id: matchId,
                  player_id: player.id,
                  wickets: wickets,
                  overs_bowled: overs,
                  runs_conceded: runs,
                  maidens: maidens,
                  catches: 0,
                  stumpings: 0,
                  run_outs: 0,
                  metadata: JSON.stringify(bowler),
                  created_at: knex.fn.now(),
                  updated_at: knex.fn.now(),
                })
                .onConflict(["match_id", "player_id"])
                .merge();
            } catch (error) {
              console.error("Error saving bowling stats:", error);
              console.error("Bowler data:", JSON.stringify(bowler, null, 2));
              continue; // Skip this bowler and continue with others
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in processInningsStats:", error);
      // Don't throw the error, just log it and return
      return;
    }
  },

  // Sync tournament matches
  async syncTournamentMatches(req, res) {
    const trx = await knex.transaction();

    try {
      const tournament = await trx("tournaments")
        .where("tournament_id", req.params.id)
        .first();

      if (!tournament) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: "Tournament not found",
        });
      }

      const metadata = tournament.metadata;
      const matchesData1 = await goalserveService.getTournamentMatches(
        metadata.raw_data.file_path
      );
      const requiredIds = ["13072001446"];
      // const requiredIds = ["13072001446", "13072002472"];

      // Filter match and remove `commentaries` and `lineups`
      const filteredMatches = matchesData1.fixtures.category.match
        // .filter(match => requiredIds.includes(match.id))
        .map((match) => {
          const cleanedMatch = { ...match };
          delete cleanedMatch.commentaries;
          // delete cleanedMatch.lineups;
          cleanedMatch.inning = match.inning;
          return cleanedMatch;
        });

      // Construct final response with same structure
      const matchesData = {
        fixtures: {
          category: {
            ...matchesData1.fixtures.category,
            match: filteredMatches,
          },
        },
      };

      const processedMatches = [];
      const processedTeams = new Map();
      const processedPlayers = new Map();

      // Check if we have the expected data structure
      if (matchesData.fixtures && matchesData.fixtures.category) {
        const category = matchesData.fixtures.category;

        if (category.match && Array.isArray(category.match)) {
          // Process matches in batches of 10
          const batchSize = 10;
          for (let i = 0; i < category.match.length; i += batchSize) {
            const batch = category.match.slice(i, i + batchSize);

            await Promise.all(
              batch.map(async function (matchData) {
                try {
                  if (!matchData.localteam || !matchData.visitorteam) {
                    return;
                  }

                  // Process teams
                  const [savedTeam1, savedTeam2] = await Promise.all([
                    tournamentController.processTeam(
                      trx,
                      matchData.localteam,
                      tournament.id,
                      processedTeams
                    ),
                    tournamentController.processTeam(
                      trx,
                      matchData.visitorteam,
                      tournament.id,
                      processedTeams
                    ),
                  ]);

                  // Extract venue information
                  const venueInfo =
                    matchData.matchinfo?.info?.find(
                      (info) => info.name === "Venue"
                    )?.value || "";
                  const cityInfo =
                    matchData.matchinfo?.info?.find(
                      (info) => info.name === "City"
                    )?.value || "";
                  const countryInfo =
                    matchData.matchinfo?.info?.find(
                      (info) => info.name === "Country"
                    )?.value || "";

                  // Convert date from DD.MM.YYYY to YYYY-MM-DD
                  const [day, month, year] = matchData.date.split(".");
                  const formattedDate = `${year}-${month}-${day}`;

                  // Create or update match
                  const [savedMatch] = await trx("matches")
                    .insert({
                      tournament_id: tournament.id,
                      team1_id: savedTeam1.id,
                      team2_id: savedTeam2.id,
                      victory_team_id:
                        matchData.localteam.winner === "True"
                          ? savedTeam1.id
                          : matchData.visitorteam.winner === "True"
                            ? savedTeam2.id
                            : null,
                      venue: venueInfo,
                      city: cityInfo,
                      country: countryInfo,
                      match_number: matchData.match_num,
                      match_type: matchData.type,
                      start_time: formattedDate,
                      status: matchData.status || "Scheduled",
                      toss: matchData.toss || null,
                      man_of_match: matchData.man_of_match || null,
                      referee: matchData.referee || null,
                      metadata: JSON.stringify({
                        api_id: matchData.id,
                        raw_data: matchData,
                      }),
                      created_at: knex.fn.now(),
                      updated_at: knex.fn.now(),
                    })
                    .returning("*");

                  // Process players for both teams
                  if (matchData.lineups) {
                    await Promise.all([
                      tournamentController.processTeamPlayers(
                        trx,
                        matchData.lineups.localteam,
                        savedTeam1.id,
                        savedMatch.id,
                        processedPlayers
                      ),
                      tournamentController.processTeamPlayers(
                        trx,
                        matchData.lineups.visitorteam,
                        savedTeam2.id,
                        savedMatch.id,
                        processedPlayers
                      ),
                    ]);
                  }

                  // Process innings statistics
                  await tournamentController.processInningsStats(
                    trx,
                    matchData,
                    savedMatch.id,
                    processedPlayers
                  );

                  processedMatches.push(savedMatch);
                } catch (error) {
                  console.error("Error processing match:", error);
                  throw error; // Re-throw to trigger transaction rollback
                }
              })
            );
          }
        }
      }

      // Commit the transaction
      await trx.commit();

      // Verify the data was saved
      const savedMatches = await knex("matches")
        .select("matches.*", "t1.name as team1_name", "t2.name as team2_name")
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        .where("matches.tournament_id", tournament.id)
        .orderBy("matches.start_time", "asc");

      res.json({
        success: true,
        message: "Tournament matches synchronized successfully",
        data: {
          tournament: {
            ...tournament,
            status: !!tournament.status,
          },
          matches: savedMatches,
        },
      });
    } catch (error) {
      await trx.rollback();
      console.error("Sync tournament matches error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to synchronize tournament matches",
        error: error.message,
      });
    }
  },
  // Sync tournaments from external API
  async syncTournaments(req, res) {
    try {
      // Get upcoming tours from Goalserve
      const toursData = await goalserveService.getUpcomingTours();
      // console.log("toursData", toursData);

      // Handle different API response structures
      let tournaments = [];
      if (toursData.fixtures && toursData.fixtures.category) {
        // Handle the new structure
        tournaments = toursData.fixtures.category;
      } else if (toursData.sport && toursData.sport.tournaments) {
        // Handle the old structure
        tournaments = toursData.sport.tournaments;
      }

      for (const tournament of tournaments) {
        // Extract common fields with fallbacks
        const tournamentData = {
          name: tournament.name,
          tournament_id: tournament.id, // Store the API's tournament ID
          season: tournament.season || new Date().getFullYear().toString(),
          start_date: tournament.start_date || null,
          end_date: tournament.end_date || null,
          status: tournament.status || "upcoming",
          category: tournament.category || "international",
          // Store all API-specific data in metadata
          metadata: JSON.stringify({
            // API-specific identifiers
            api_id: tournament.id,
            file_path: tournament.file_path,
            squads_file: tournament.squads_file,
            table_file: tournament.table_file,
            // Additional fields that might be present in different APIs
            type: tournament.type,
            country: tournament.country,
            format: tournament.format,
            // Store the entire raw tournament data for future use
            raw_data: tournament,
          }),
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        };

        await knex("tournaments").insert(tournamentData);
      }

      res.json({
        success: true,
        data: toursData,
        message: "Tournaments synchronized successfully",
        count: tournaments.length,
      });
    } catch (error) {
      console.error("Sync tournaments error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to synchronize tournaments",
        error: error.message,
      });
    }
  },

  async testTournaments(req, res) {
    try {
      // const matchesData1 = await goalserveService.getTournamentMatches("/intl/1015");
      // const matchesData = await goalserveService.getMatchStats("13072002472");
      // const matchesData = await goalserveService.getTournamentSquads("/intl/1015_squads");
      const matchesData = await goalserveService.getIPLSquads();
      // console.log('Raw Matches data:', JSON.stringify(matchesData, null, 2));

      // const requiredIds = ["13072001446"];

      // const matchesData = {
      //     fixtures: {
      //         category: {
      //             ...matchesData1.fixtures.category,
      //             match: matchesData1.fixtures.category.match.filter(match =>
      //                 requiredIds.includes(match.id)
      //             )
      //         }
      //     }
      // };

      const matchesData1 = await goalserveService.getIPLSquads();
      // const requiredIds = ["13072001446", "13072002472"];

      // // Filter match and remove `commentaries` and `lineups`
      // const filteredMatches = matchesData1.fixtures.category.match
      //     .filter(match => requiredIds.includes(match.id))
      //     .map(match => {
      //         const cleanedMatch = { ...match };
      //         // Only remove commentaries and lineups, keep innings data
      //         delete cleanedMatch.commentaries;
      //         delete cleanedMatch.lineups;
      //         // Preserve innings data
      //         cleanedMatch.inning = match.inning;
      //         return cleanedMatch;
      //     });

      // // Construct final response with same structure
      // const matchesData = {
      //     fixtures: {
      //         category: {
      //             ...matchesData1.fixtures.category,
      //             match: filteredMatches
      //         }
      //     }
      // }

      if (
        matchesData1?.squads?.category?.team &&
        Array.isArray(matchesData1.squads.category.team)
      ) {
        const teams = matchesData1.squads.category.team;

        for (const team of teams) {
          if (Array.isArray(team.player)) {
            for (const player of team.player) {
              const playerId = player.name;
              const name = player.id;
              const role = player.role;

              await knex("players")
                .where("player_id", playerId)
                .where("name", name)
                .update({ role });
            }
          }
        }
      }

      res.json({
        success: true,
        data: matchesData1,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch tournaments",
        error: error.message,
      });
    }
  },
};

module.exports = tournamentController;
