const PlayerStats = require("../../models/player_stats");
const { ERROR, PLAYER } = require("../../utils/responseMsg");
const apiResponse = require("../../utils/apiResponse");
const { knex: db } = require("../../config/database");

exports.getPlayerStatsByPlayer = async (req, res) => {
  try {
    const { player_id } = req.params;
    const user_id = req.user.id;



    if (!player_id) {
      return apiResponse.ErrorResponse(res, PLAYER.invalidPlayerId);
    }

    // const playerDetails = await db("players as p")
    //   .leftJoin("teams as t", "p.team_id", "t.id")
    //   .leftJoin("countries as c", db.raw("p.nationality::integer"), "c.country_id")
    //   .where("p.player_id", player_id)
    //   .select(
    //     "p.name",
    //     "p.points",
    //     "p.credits",
    //     "p.role",
    //     "p.date_of_birth as dob",
    //     "c.name as nationality",
    //     "p.metadata",
    //     "p.selected_by_percentage",
    //     "t.name as team_name",
    //     "t.short_name as shortname "
    //   )
    //   .first();
    const playerDetails = await db("players as p")
  .leftJoin("player_teams as pt", "p.id", "pt.player_id")
  .leftJoin("teams as t", "pt.team_id", "t.id")  
  .leftJoin("countries as c", db.raw("p.nationality::integer"), "c.country_id")
  .where("p.player_id", player_id)
  .select(
    "p.name",
    "p.points", 
    "p.credits",
    "p.role",
    "p.date_of_birth as dob",
    "c.name as nationality",
    "p.metadata",
    "p.selected_by_percentage",
    "t.name as team_name",       
    "t.short_name as shortname"  
  )
  .first();
    

    

    if (!playerDetails) {
      return apiResponse.notFoundResponse(res, PLAYER.playerNotFound);
    }

   
    let imagePath = null;
    try {
      if (playerDetails.metadata) {
        const metadata = typeof playerDetails.metadata === 'string' ? JSON.parse(playerDetails.metadata) : playerDetails.metadata;
        imagePath = metadata.image_path || null;
      }
    } catch (error) {
      console.log("Error parsing metadata for player:", player_id, error);
    }

    // Get internal player ID first
    const internalPlayer = await db("players").where("player_id", player_id).select("id").first();
    const internalPlayerId = internalPlayer?.id;

    const tourFantasyStats = await db("player_stats as ps")
      .where("ps.player_id", internalPlayerId || player_id)
      .select(
        db.raw("COUNT(DISTINCT ps.match_id) as total_matches_played"),
        db.raw(
          "ROUND(AVG(COALESCE(ps.fantasy_points, 0))::numeric, 2) as average_points"
        )
      )
      .first();

 

    const currentTourStats = await db("player_stats as ps")
      .join("matches as m", "ps.match_id", "m.id")
      .join("teams as t1", "m.team1_id", "t1.id")
      .join("teams as t2", "m.team2_id", "t2.id")
      .leftJoin("teams as player_team", "ps.player_id", "player_team.id")
      .where("ps.player_id", internalPlayerId || player_id)
      .select(
        "ps.id",
        db.raw(
          "CASE WHEN t1.id = player_team.id THEN t2.short_name ELSE t1.short_name END as match"
        ),
        db.raw("TO_CHAR(m.start_time, 'DD Mon YYYY') as date"),
        db.raw(
          "CASE WHEN m.toss IS NOT NULL THEN m.toss ELSE 'Toss not decided' END as decision"
        ),
        db.raw("COALESCE(ps.fantasy_points, 0) as points"),
        db.raw("COALESCE(ps.runs_scored, 0) as batting_pts"),
        db.raw("COALESCE(ps.wickets, 0) as bowling_pts"),
        db.raw(
          "COALESCE(ps.catches, 0) + COALESCE(ps.stumpings, 0) + COALESCE(ps.run_outs, 0) as other_pts"
        )
      )
      .orderBy("m.start_time", "desc");

 

    const allUserTeams = await db("fantasy_teams as ft")
      .where("ft.user_id", user_id)
      .select("ft.id", "ft.name", "ft.user_id");

  

    const allPlayerTeams = await db("fantasy_team_players as ftp")
      .where("ftp.player_id", internalPlayerId || player_id)
      .select("ftp.fantasy_team_id", "ftp.player_id");

  

    const teamsWithPlayerOwners = await db("fantasy_teams as ft")
      .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
      .where("ftp.player_id", internalPlayerId || player_id)
      .select("ft.id", "ft.name", "ft.user_id");



    const usersWithTeams = await db("fantasy_teams as ft")
      .select("ft.user_id")
      .distinct();

  

    const userTeamsWithPlayer = await db("fantasy_teams as ft")
      .join("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
      .whereRaw("ft.user_id = ?", [parseInt(user_id)])
      .whereRaw("ftp.player_id = ?", [parseInt(internalPlayerId || player_id)])
      .select("ft.name as fantasy_team_name");

   

    const alternativeQuery = await db.raw(
      `
      SELECT ft.name AS fantasy_team_name
      FROM fantasy_teams AS ft
      JOIN fantasy_team_players AS ftp ON ft.id = ftp.fantasy_team_id
      WHERE ft.user_id = ? AND ftp.player_id = ?
    `,
      [parseInt(user_id), parseInt(internalPlayerId || player_id)]
    );

 

    const inmyteam =
      userTeamsWithPlayer.length > 0
        ? userTeamsWithPlayer.map((team) => team.fantasy_team_name).join(", ")
        : null;

    // Calculate dream_team percentage
    const dreamTeamStats = await db("fantasy_teams as ft")
      .leftJoin("fantasy_team_players as ftp", "ft.id", "ftp.fantasy_team_id")
      .leftJoin("fantasy_games as fg", "ft.id", "fg.fantasy_team_id")
      .where("ft.match_id", "in", function() {
        this.select("match_id")
          .from("player_stats")
          .where("player_id", internalPlayerId || player_id);
      })
      .select(
        db.raw("COUNT(DISTINCT ft.id) as total_teams"),
        db.raw("COUNT(DISTINCT CASE WHEN ftp.player_id = ? THEN ft.id END) as teams_with_player", [internalPlayerId || player_id]),
        db.raw("COUNT(DISTINCT CASE WHEN ftp.player_id = ? AND fg.status = 'completed' AND fg.rank <= 3 THEN ft.id END) as winning_teams_with_player", [internalPlayerId || player_id])
      )
      .first();



    let dreamTeamPercentage = "NA";
    if (dreamTeamStats && dreamTeamStats.teams_with_player > 0) {
      const percentage = (dreamTeamStats.winning_teams_with_player / dreamTeamStats.teams_with_player * 100).toFixed(1);
      dreamTeamPercentage = `${percentage}%`;
    }

    const formattedCurrentTourStats = currentTourStats.map((stat, index) => ({
      id: index + 1,
      match: stat.match,
      date: stat.date,
      decision: stat.decision,
      selectedBy: playerDetails.selected_by_percentage
        ? `${playerDetails.selected_by_percentage}%`
        : "0%",
      points: stat.points,
      credits: playerDetails.credits,
      battingPts: stat.batting_pts,
      bowlingPts: stat.bowling_pts,
      otherPts: stat.other_pts,
    }));

    const responseData = {
      player_details: {
        image_url: imagePath,
        name: playerDetails.name,
        points: playerDetails.points,
        credits: playerDetails.credits,
        role: playerDetails.role,
        dob: playerDetails.dob,
        nationality: playerDetails.nationality,
        team: playerDetails.team_name,
        shortname: playerDetails.shortname,
      },
      tour_fantasy_stats: {
        total_matches_played: tourFantasyStats.total_matches_played || 0,
        average_points:
          tourFantasyStats.average_points &&
          parseFloat(tourFantasyStats.average_points) > 0
            ? parseFloat(tourFantasyStats.average_points)
            : Number(tourFantasyStats.total_matches_played) > 0
            ? (
                playerDetails.points /
                Number(tourFantasyStats.total_matches_played)
              ).toFixed(2)
            : 0,
        dream_team: dreamTeamPercentage,
      },
      current_tour_stats: formattedCurrentTourStats,
      // inmyteam: inmyteam
    };

    return apiResponse.successResponseWithData(
      res,
      PLAYER.dataFound,
      responseData
    );
  } catch (error) {
    console.error("getPlayerStatsByPlayer error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
};

exports.createPlayerStat = async (req, res) => {
  try {
    const {
      match_id,
      player_id,
      runs,
      fours,
      sixes,
      wickets,
      overs,
      maiden_overs,
      economy,
      catches,
      stumpings,
      runouts,
      is_duck,
    } = req.body;
    const playerStat = await PlayerStats.create({
      match_id,
      player_id,
      runs,
      fours,
      sixes,
      wickets,
      overs,
      maiden_overs,
      economy,
      catches,
      stumpings,
      runouts,
      is_duck,
    });
    res.status(201).json(playerStat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPlayerStatsByMatch = async (req, res) => {
  try {
    const playerStats = await PlayerStats.findByMatch(req.params.match_id);
    res.json(playerStats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
