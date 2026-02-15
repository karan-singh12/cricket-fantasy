const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator, listing } = require("../../utils/functions");
const { ERROR, USER, SUCCESS, CONTEST } = require("../../utils/responseMsg");

const contestController = {
  async getContestLeaderboard(req, res) {
    try {
      const { contest_id } = req.params;
    
      const { page = 1, limit = 10, user_id } = req.query;

      // Get contest details
      const contest = await db("contests").where("id", contest_id).first();

      if (!contest) {
        return apiResponse.ErrorResponse(res, CONTEST.contestNotFound);
      }

      // Get all entries for this contest
      const entries = await db("user_contest_entries")
        .select(
          "user_contest_entries.*",
          "users.username",
          "users.profile_image",
          "fantasy_teams.team_name",
          db.raw("COALESCE(SUM(fantasy_points.points), 0) as total_points")
        )
        .leftJoin("users", "user_contest_entries.user_id", "users.id")
        .leftJoin(
          "fantasy_teams",
          "user_contest_entries.team_id",
          "fantasy_teams.id"
        )
        .leftJoin(
          "fantasy_points",
          "fantasy_points.team_id",
          "fantasy_teams.id"
        )
        .where("user_contest_entries.contest_id", contest_id)
        .groupBy(
          "user_contest_entries.id",
          "users.username",
          "users.profile_image",
          "fantasy_teams.team_name"
        )
        .orderBy("total_points", "desc")
        .modify((query) => {
          if (page && limit) {
            query.limit(limit).offset((page - 1) * limit);
          }
        });

      // Get total count for pagination
      const totalEntries = await db("user_contest_entries")
        .count("* as total")
        .where("contest_id", contest_id)
        .first();

      // Get current user's rank if user_id is provided
      let userRank = null;
      if (user_id) {
        const userEntry = await db("user_contest_entries")
          .select(
            "user_contest_entries.*",
            "users.username",
            "users.profile_image",
            "fantasy_teams.team_name",
            db.raw("COALESCE(SUM(fantasy_points.points), 0) as total_points")
          )
          .leftJoin("users", "user_contest_entries.user_id", "users.id")
          .leftJoin(
            "fantasy_teams",
            "user_contest_entries.team_id",
            "fantasy_teams.id"
          )
          .leftJoin(
            "fantasy_points",
            "fantasy_points.team_id",
            "fantasy_teams.id"
          )
          .where("user_contest_entries.contest_id", contest_id)
          .where("user_contest_entries.user_id", user_id)
          .groupBy(
            "user_contest_entries.id",
            "users.username",
            "users.profile_image",
            "fantasy_teams.team_name"
          )
          .first();

        if (userEntry) {
          userRank = await db("user_contest_entries")
            .select(db.raw("COUNT(*) + 1 as rank"))
            .leftJoin(
              "fantasy_teams",
              "user_contest_entries.team_id",
              "fantasy_teams.id"
            )
            .leftJoin(
              "fantasy_points",
              "fantasy_points.team_id",
              "fantasy_teams.id"
            )
            .where("user_contest_entries.contest_id", contest_id)
            .whereRaw("COALESCE(SUM(fantasy_points.points), 0) > ?", [
              userEntry.total_points,
            ])
            .groupBy("user_contest_entries.id")
            .first();
        }
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        leaderboard: entries,
        total_entries: totalEntries.total,
        user_rank: userRank?.rank || null,
        contest: {
          id: contest.id,
          name: contest.name,
          total_spots: contest.total_spots,
          filled_spots: contest.filled_spots,
          entry_fee: contest.entry_fee,
          prize_pool: contest.prize_pool,
          winnings: JSON.parse(contest.winnings),
          status: contest.status,
        },
      });
    } catch (error) {
      console.error("Leaderboard error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAvailableContests(req, res) {
    try {
      let { matchId, entryFeeRange, totalSpotsRange, contestType } = req.body;
    

      if (!matchId) {
        return apiResponse.ErrorResponse(res, CONTEST.matchIdrequired);
      }

      const contests = await db("contests as c")
        .select(
          "c.*",
          "m.start_time",
          "t1.name as team1_name",
          "t2.name as team2_name"
        )
        .leftJoin("matches as m", "c.match_id", "m.id")
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .where("c.match_id", matchId)
        .whereNot("c.status","deleted")
        .whereNot("c.status","completed")
        .modify((query) => {
          if (entryFeeRange?.start != null && entryFeeRange?.end != null) {
            query.whereBetween("c.entry_fee", [
              entryFeeRange.start,
              entryFeeRange.end,
            ]);
          }
          if (totalSpotsRange?.start != null && totalSpotsRange?.end != null) {
            query.whereBetween("c.total_spots", [
              totalSpotsRange.start,
              totalSpotsRange.end,
            ]);
          }
          if (contestType) {
            query.andWhere("c.contest_type", contestType);
          }
        })
        .orderBy("c.id", "asc");

      const updatedContests = contests.map((contest) => {
        let winnings = [];
        let winningsTotal = 0;
        let winningPercentage = 0;

        if (contest.winnings) {
          try {
            winnings =
              typeof contest.winnings === "string"
                ? JSON.parse(contest.winnings)
                : contest.winnings;

            winningsTotal = winnings.reduce((sum, win) => sum + win.price, 0);

            const maxWinners = Math.max(...winnings.map((win) => win.to));
            if (contest.total_spots > 0) {
              winningPercentage = Math.round(
                (maxWinners / contest.total_spots) * 100
              );
            }
          } catch (e) {
            console.warn("Invalid winnings JSON for contest ID:", contest.id);
          }
        }

        const remainingSpots = Math.max(
          0,
          contest.total_spots - contest.filled_spots
        );

        return {
          ...contest,
          winnings_total: winningsTotal,
          winning_percentage: winningPercentage,
          remaining_spots: remainingSpots,
        };
      });

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        contests: updatedContests,
      });
    } catch (error) {
      console.error("Contest error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async createContest(req, res) {
    try {
      const {
        match_id,
        name,
        entry_fee,
        total_prize_pool,
        prize_breakup,
        winnings,
        start_time,
        end_time,
        total_spots,
        contest_type,
        per_user_entry,
      } = req.body;

      if (!match_id) {
        return apiResponse.ErrorResponse(res, CONTEST.matchIdrequired);
      }

      // Validate match exists and is upcoming
      const match = await db("matches")
        .where("id", match_id)
        .where("status", "NS")
        .first();

      if (!match) {
        return apiResponse.ErrorResponse(res, CONTEST.invalidmatchNOTNS);
      }

      const Tid = await db("matches")
        .where("id", match_id)
        .select("tournament_id")
        .first();

      const [contest] = await db("contests")
        .insert({
          match_id,
          name,
          entry_fee,
          prize_pool: total_prize_pool,
          total_spots,
          filled_spots: 0,
          tournament_id: Tid.tournament_id,
          start_time,
          end_time,
          per_user_entry,
          contest_type,
          winnings: JSON.stringify(winnings),
          rules: prize_breakup,
          // created_by: req.user.id,

          created_by_user: req.user.id,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
          // status: default upcoming
        })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        CONTEST.contestAdded,
        contest
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getMyContests(req, res) {
    try {
      const userId = req.user.id;
      const { match_id } = req.body;
    

      const userTeams = await db("fantasy_teams")
        .select("id")
        .where("user_id", userId)
        .orderBy("id", "asc");

      const teamIndexMap = {};
      userTeams.forEach((team, index) => {
        teamIndexMap[team.id] = `T${index + 1}`;
      });

      const contests = await db("fantasy_games as fg")
        .select(
          "c.*",
          "m.start_time",
          "t1.name as team1_name",
          "t2.name as team2_name",
          "ft.name as fantasy_team_name",
          "ft.contest_id as fantasy_team_contest_id",
          "ft.total_points as fantasy_team_points",
          "fg.fantasy_team_id as joined_team_id",
          "fg.rank as user_rank",
          "fg.points as user_points",
          "fg.status as entry_status",
          "fg.team_name_user",

          db.raw(`
                        (SELECT p.name
                        FROM fantasy_team_players ftp
                        JOIN players p ON p.id = ftp.player_id
                        WHERE ftp.fantasy_team_id = fg.fantasy_team_id AND ftp.is_captain = true
                        LIMIT 1) as captain_name
                    `),
          db.raw(`
                        (SELECT p.metadata->>'image_path'
                        FROM fantasy_team_players ftp
                        JOIN players p ON p.id = ftp.player_id
                        WHERE ftp.fantasy_team_id = fg.fantasy_team_id AND ftp.is_captain = true
                        LIMIT 1) as captain_image
                    `),

          db.raw(`
                        (SELECT p.name
                        FROM fantasy_team_players ftp
                        JOIN players p ON p.id = ftp.player_id
                        WHERE ftp.fantasy_team_id = fg.fantasy_team_id AND ftp.is_vice_captain = true
                        LIMIT 1) as vice_captain_name
                    `),
          db.raw(`
                        (SELECT p.metadata->>'image_path'
                        FROM fantasy_team_players ftp
                        JOIN players p ON p.id = ftp.player_id
                        WHERE ftp.fantasy_team_id = fg.fantasy_team_id AND ftp.is_vice_captain = true
                        LIMIT 1) as vice_captain_image
                    `)
        )
        .join("contests as c", "fg.contest_id", "c.id")
        .join("matches as m", "c.match_id", "m.id")
        .join("teams as t1", "m.team1_id", "t1.id")
        .join("teams as t2", "m.team2_id", "t2.id")
        .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .where("fg.user_id", userId)
        .modify((query) => {
          if (match_id) {
            query.where("c.match_id", match_id);
          }
        })
        .orderBy("m.start_time", "desc");

     

      const contestsWithWinnings = await Promise.all(contests.map(async (contest, index) => {
        let winningsTotal = 0;
        let winningPercentage = 0;

        if (contest.winnings) {
          const winnings =
            typeof contest.winnings === "string"
              ? JSON.parse(contest.winnings)
              : contest.winnings;

          winningsTotal = winnings.reduce((sum, win) => sum + win.price, 0);

          const maxWinners = Math.max(...winnings.map((win) => win.to));

          if (contest.total_spots > 0) {
            winningPercentage = Math.round(
              (maxWinners / contest.total_spots) * 100
            );
          }
        }

        // Calculate remaining spots
        const remainingSpots = Math.max(
          0,
          contest.total_spots - contest.filled_spots
        );

        const joinedTeamIdT = `T${index + 1}`;

        // --- Fetch players and backup_players for this contest's joined_team_id ---
        let players = [];
        let backup_players = [];
        if (contest.joined_team_id) {
          // Get match info for team1_id and team2_id
          const match = await db("matches as m")
            .select(
              "m.id as match_id",
              "t1.id as team1_id",
              "t2.id as team2_id",
              "t1.name as team1_name",
              "t2.name as team2_name",
              "t1.logo_url as team1_image",
              "t2.logo_url as team2_image",
              "t1.short_name as team1_short_name",
              "t2.short_name as team2_short_name",
              "m.team1_id",
              "m.team2_id"
            )
            .leftJoin("teams as t1", "m.team1_id", "t1.id")
            .leftJoin("teams as t2", "m.team2_id", "t2.id")
            .where("m.id", contest.match_id)
            .first();

          if (match) {
            // Resolve season for this match's tournament to scope player_teams
            let seasonIdForMatch = null;
            try {
              const tRow = await db("tournaments")
                .select("season", "metadata")
                .where({ id: contest.tournament_id })
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
            } catch (_e) {}

            // Get all players for this fantasy team
            const rows = await db("fantasy_teams as ft")
              .select(
                "ft.id as fantasy_team_id",
                "ft.name as fantasy_team_name",
                "ft.total_points",
                "ft.status as team_status",
                // include ftp.id to allow ORDER BY with DISTINCT ON
                "ftp.id as ftp_row_id",
                "ftp.player_id",
                "ftp.is_captain",
                "ftp.is_vice_captain",
                "ftp.substitute",
                "p.name as player_name",
                "p.metadata",
                "p.role as player_role",
                "pt.team_id as player_team_id",
                "t.name as player_team_name"
              )
              // Use DISTINCT ON (PostgreSQL) to keep the first row per (player_id, team_id)
              .distinctOn(["ftp.player_id", "pt.team_id"])
              .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
              .join("players as p", "ftp.player_id", "p.id")
              .join("player_teams as pt", function () {
                this.on("p.id", "pt.player_id");
                if (seasonIdForMatch) this.andOn("pt.season_id", db.raw("?", [seasonIdForMatch]));
              })
              .leftJoin("teams as t", "pt.team_id", "t.id")
              .where("ft.id", contest.joined_team_id)
              .whereIn("pt.team_id", [match.team1_id, match.team2_id])
              // Order by the DISTINCT ON keys first, then by ftp_row_id to pick the first occurrence
              .orderBy("ftp.player_id")
              .orderBy("pt.team_id")
              .orderBy("ftp_row_id", "asc");

            // Captain/Vice-captain stats for percentages
            const totalTeamsCount = 1; 
            const playerIds = rows.map((r) => r.player_id);
            let capVcStats = {};
            if (playerIds.length > 0) {
              const capVcStatsArr = await db("fantasy_team_players as ftp")
                .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
                .where("ft.id", contest.joined_team_id)
                .whereIn("ftp.player_id", playerIds)
                .select(
                  "ftp.player_id",
                  db.raw(
                    "SUM(CASE WHEN ftp.is_captain THEN 1 ELSE 0 END) as captain_count"
                  ),
                  db.raw(
                    "SUM(CASE WHEN ftp.is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
                  )
                )
                .groupBy("ftp.player_id");
              capVcStats = {};
              capVcStatsArr.forEach((stat) => {
                capVcStats[stat.player_id] = {
                  captain_count: parseInt(stat.captain_count) || 0,
                  vice_captain_count: parseInt(stat.vice_captain_count) || 0,
                };
              });
            }

            // Build players and backup_players arrays
            players = [];
            backup_players = [];
            const seenComposite = new Set();
            for (const row of rows) {
              let imagePath = null;
              try {
                if (row.metadata) {
                  const metadata =
                    typeof row.metadata === "string"
                      ? JSON.parse(row.metadata)
                      : row.metadata;
                  imagePath = metadata.image_path || null;
                }
              } catch (error) {
                // ignore
              }
              const stats = capVcStats[row.player_id] || {
                captain_count: 0,
                vice_captain_count: 0,
              };
              const playerObj = {
                id: row.player_id,
                name: row.player_name,
                role: row.player_role,
                is_captain: row.is_captain,
                image_path: imagePath,
                is_vice_captain: row.is_vice_captain,
                substitute: row.substitute,
                teamId: row.player_team_id,
                team: row.player_team_name,
                captain_percentage: ((stats.captain_count / totalTeamsCount) * 100).toFixed(2),
                vice_captain_percentage: ((stats.vice_captain_count / totalTeamsCount) * 100).toFixed(2),
              };
              const key = `${Number(row.player_id)}:${Number(row.player_team_id)}`;
              if (seenComposite.has(key)) continue;
              seenComposite.add(key);
              if (row.substitute) {
                backup_players.push(playerObj);
              } else {
                players.push(playerObj);
              }
            }
          }
        }
      

        return {
          ...contest,
          captain_image: contest.captain_image,
          vice_captain_image: contest.vice_captain_image,
          winnings_total: winningsTotal,
          winning_percentage: winningPercentage,
          remaining_spots: remainingSpots,
          joined_team_id_T: contest.team_name_user,
          players,
          backup_players,
        };
      }));

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        contestsWithWinnings
      );
    } catch (error) {
      console.error("getMyContests error:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  
// not working
  async joinContest(req, res) {
    try {
 
      const { contest_id, fantasy_team_id } = req.body;

   
      const contest = await db("contests")
        .where("id", contest_id)
        .where("status", "open")
        .first();
      
      if (!contest) {
        return res.status(400).json({ error: "Contest not found or not open" });
      }

      // Verify fantasy team belongs to user
      const fantasyTeam = await db("fantasy_teams")
        .where("id", fantasy_team_id)
        .where("user_id", req.user.id)
        .first();
      
      if (!fantasyTeam) {
        return res.status(400).json({ error: "Fantasy team not found" });
      }

      // Check if already joined
      const existing = await db("fantasy_team_contests")
        .where({
          contest_id,
          fantasy_team_id,
        })
        .first();
      

      if (existing) {
        return res.status(400).json({ error: "Already joined this contest" });
      }

      // Check if contest is full
      const currentEntries = await db("fantasy_team_contests")
        .where("contest_id", contest_id)
        .count("id as count")
        .first();
      
      if (parseInt(currentEntries.count) >= contest.max_entries) {
        return res.status(400).json({ error: "Contest is full" });
      }

      // Join contest
      await db("fantasy_team_contests").insert({
        contest_id,
        fantasy_team_id,
        joined_at: new Date(),
      });

      // Update contest entries count
      await db("contests")
        .where("id", contest_id)
        .increment("current_entries", 1);

      res.json({ message: "Successfully joined contest" });
    } catch (error) {
      res.status(500).json({ error: error.message });
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

      const userTeams = await db("fantasy_teams")
        .where({
          user_id: req.user.id,
          match_id: contest.match_id,
          status: 1,
        })
        .count("id as count")
        .first();

      const finalContest = {
        ...contest,
        firstPrize,
        winPercentage,
        totalUserTeams: parseInt(userTeams.count) || 0,
      };

      return apiResponse.successResponseWithData(res, CONTEST.contestFound, {
        contest: finalContest,
      });
    } catch (error) {
      console.error("Contest error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async editContestName(req, res) {
    try {
      let { contestId, name } = req.body;

      const contest = await db("contests")
        .where({ id: contestId, created_by_user: req.user.id })
        .first();

      if (!contest) {
        return apiResponse.ErrorResponse(res, CONTEST.contestNotCreatedbyYou);
      }

      // Update the contest name
      const [updated] = await db("contests")
        .where({ id: contestId })
        .update({ name, updated_at: db.fn.now() })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        CONTEST.contestUpdated,
        updated
      );
    } catch (error) {
      console.error("editContestName error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getRecentContests(req, res) {
    try {
      const { matchId } = req.params;
      const { page = 1, limit = 10, user_id } = req.query;

      // Get completed contests for this match
      const contests = await db("contests")
        .select(
          "contests.*",
          db.raw(
            "COUNT(DISTINCT user_contest_entries.user_id) as participants_count"
          ),
          db.raw(
            "SUM(CASE WHEN user_contest_entries.user_id = ? THEN 1 ELSE 0 END) as user_joined",
            [user_id]
          ),
          db.raw("MAX(fantasy_points.points) as highest_score")
        )
        .leftJoin(
          "user_contest_entries",
          "contests.id",
          "user_contest_entries.contest_id"
        )
        .leftJoin(
          "fantasy_points",
          "user_contest_entries.team_id",
          "fantasy_points.team_id"
        )
        .where("contests.match_id", matchId)
        .where("contests.status", "Completed")
        .groupBy("contests.id")
        .orderBy("contests.end_time", "desc")
        .modify((query) => {
          if (page && limit) {
            query.limit(limit).offset((page - 1) * limit);
          }
        });

      // Get total count for pagination
      const totalContests = await db("contests")
        .count("* as total")
        .where("match_id", matchId)
        .where("status", "Completed")
        .first();

      // Get user's contest details if user_id is provided
      let userContestDetails = null;
      if (user_id) {
        userContestDetails = await db("user_contest_entries")
          .select(
            "user_contest_entries.*",
            "fantasy_teams.team_name",
            db.raw("COALESCE(SUM(fantasy_points.points), 0) as total_points")
          )
          .leftJoin(
            "fantasy_teams",
            "user_contest_entries.team_id",
            "fantasy_teams.id"
          )
          .leftJoin(
            "fantasy_points",
            "fantasy_points.team_id",
            "fantasy_teams.id"
          )
          .where("user_contest_entries.user_id", user_id)
          .whereIn(
            "user_contest_entries.contest_id",
            contests.map((c) => c.id)
          )
          .groupBy("user_contest_entries.id", "fantasy_teams.team_name");
      }

      // Format the response
      const formattedContests = contests.map((contest) => ({
        ...contest,
        joined: !!contest.user_joined,
        user_contest_details:
          userContestDetails?.find((uc) => uc.contest_id === contest.id) ||
          null,
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        contests: formattedContests,
        total_contests: totalContests.total,
      });
    } catch (error) {
      console.error("Recent contests error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = contestController;
