const config = require("../../config/config");
const { knex: db } = require("../../config/database");
const moment = require("moment");

const apiResponse = require('../../utils/apiResponse'); // Your API response utility
const { ERROR , SUCCESS} = require("../../utils/responseMsg");



// Fetch finished matches for the initial load (My Contests tab)
async function getMyFinishedMatches(req, res) {
  try {
    const userId = req.user.id;
    console.log(userId)

    // Query to get only finished matches with timestamp fields
    const matches = await db("fantasy_games as fg")
      .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
      .join("matches as m", "ft.match_id", "m.id")
      .join("teams as t1", "m.team1_id", "t1.id")
      .join("teams as t2", "m.team2_id", "t2.id")
      .join("tournaments as tour", "m.tournament_id", "tour.id")
      .where("fg.user_id", userId)
      .whereIn("m.status", ["Finished", "Completed"])
      .select(
        "m.id",
        "m.tournament_id",
        "m.sm_match_id",
        "m.status",
        "m.start_time",
        "m.end_time",
        "m.created_at",
        "m.updated_at",
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
        "m.tournament_id",
        "m.sm_match_id",
        "m.status",
        "m.start_time",
        "m.end_time",
        "m.created_at",
        "m.updated_at",
        "t1.name",
        "t1.short_name",
        "t2.name",
        "t2.short_name",
        "tour.name",
        "t1.logo_url",
        "t2.logo_url"
      )
      .orderBy("m.start_time", "desc");

    if (matches.length === 0) {
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, []);
    }

    const matchIds = matches.map(m => m.id);

    // Get contest counts
    const contestCounts = await db("fantasy_games as fg")
  .join("contests as c", "fg.contest_id", "c.id")
  .select("c.match_id")
  .count("c.id as contest_count")
  .where("fg.user_id", userId)
  .whereIn("c.match_id", matchIds)
  .groupBy("c.match_id");

const contestCountMap = new Map(
  contestCounts.map(c => [c.match_id, parseInt(c.contest_count)])
);

    // Get user's teams count
    const userTeamsCounts = await db("fantasy_games as fg")
      .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
      .select("ft.match_id")
      .count("fg.id as teams_count")
      .where("fg.user_id", userId)
      .whereIn("ft.match_id", matchIds)
      .groupBy("ft.match_id");
    const userTeamsCountMap = new Map(
      userTeamsCounts.map(t => [t.match_id, parseInt(t.teams_count)])
    );

    // Get basic contest info (without leaderboard)
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
        db.raw('COALESCE(lb."totalScore", 0) as total_points'),
        "u.name as username",
        "u.image_url as profile_image",
        db.raw('COALESCE(lb."rank", NULL) as rank')
      )
      .where("fg.user_id", userId)
      .whereIn("c.match_id", matchIds);

    // Group contests by match
    const contestsByMatchId = new Map();
    for (const row of contestEntries) {
      if (!contestsByMatchId.has(row.match_id)) {
        contestsByMatchId.set(row.match_id, []);
      }
      contestsByMatchId.get(row.match_id).push({
        contest_id: row.contest_id,
        team_label: row.team_name_user,
        fantasy_team_id: row.fantasy_team_id,
        fantasy_team_name: row.fantasy_team_name,
        points: Number(row.total_points),
        filled_spots: Number(row.filled_spots),
        username: row.username,
        profile_image: row.profile_image ? `${config.baseURL}/${row.profile_image}` : null,
        rank: row.rank
      });
    }

    // Format the response with all requested fields including timestamps
    const formattedMatches = matches.map(match => {
      const time_ago = moment(match.start_time).fromNow();
      
      return {
        start_time: match.start_time,
        id: match.id,
        tournament_id: match.tournament_id,
        sm_match_id: match.sm_match_id,
        team1_name: match.team1_name,
        team1_short_name: match.team1_short_name,
        team1_logo_url: match.team1_logo_url,
        team2_name: match.team2_name,
        team2_short_name: match.team2_short_name,
        team2_logo_url: match.team2_logo_url,
        tournament_name: match.tournament_name,
        total_contest: contestCountMap.get(match.id) || 0,
        total_teams: userTeamsCountMap.get(match.id) || 0,
        status: match.status,
        end_time: match.end_time,
        created_at: match.created_at,
        updated_at: match.updated_at,
        time_ago: time_ago,
        contests: contestsByMatchId.get(match.id) || []
      };
    });

    return apiResponse.successResponseWithData(
      res,
      SUCCESS.dataFound,
      formattedMatches
    );
  } catch (error) {
    console.error("getMyFinishedMatches error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

// Fetch match details for a specific match (on card click)
async function getFinishedMatchDetails(req, res) {
  try {
    const userId = req.user.id;
    const { sm_match_id } = req.body;

    // Get match details with all timestamp fields
    const match = await db("matches as m")
      .join("teams as t1", "m.team1_id", "t1.id")
      .join("teams as t2", "m.team2_id", "t2.id")
      .join("tournaments as tour", "m.tournament_id", "tour.id")
      .leftJoin("venues as v", "m.venue", "v.venue_id")
      .leftJoin("countries as c", "v.country_id", "c.country_id")
      .where("m.sm_match_id", sm_match_id)
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
      .first();

    if (!match) {
      return apiResponse.notFoundResponse(res, "Match not found");
    }

    // Calculate time_ago
    const time_ago = moment(match.start_time).fromNow();

    // Parse metadata for toss and result
    let toss = null;
    let result_note = null;
    let winner_team = null;
    
    const metadata = typeof match.metadata === 'string' 
      ? JSON.parse(match.metadata) 
      : match.metadata;

    if (metadata) {
      // Toss information
      if (metadata.toss_won_team_id && metadata.elected) {
        const tossTeam = metadata.toss_won_team_id === metadata.localteam_id 
          ? match.team1_name 
          : match.team2_name;
        toss = `${tossTeam} won the toss and elected to ${metadata.elected}`;
      }

      // Result information
      result_note = metadata.note || null;
      const victoryTeamId = metadata.winner_team_id;
      if (victoryTeamId) {
        winner_team = victoryTeamId === match.team1_id ? {
          id: match.team1_id,
          name: match.team1_name,
          short_name: match.team1_short_name,
          logo_url: match.team1_logo_url
        } : {
          id: match.team2_id,
          name: match.team2_name,
          short_name: match.team2_short_name,
          logo_url: match.team2_logo_url
        };
      }
    }

    // Get user's teams for this match with rank information
    const userTeams = await db("fantasy_games as fg")
      .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
      .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
      .where("fg.user_id", userId)
      .where("ft.match_id", match.id)
      .select(
        "ft.id as fantasy_team_id",
        "ft.name as fantasy_team_name",
        "ft.total_points",
        "fg.team_name_user as team_label",
        db.raw('COALESCE(lb."rank", NULL) as rank')
      );
      const userContests = await db("fantasy_games as fg")
      .join("contests as c", "fg.contest_id", "c.id")
      .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
      .where("fg.user_id", userId)
      .where("c.match_id", match.id)
      .select(
        "c.id as contest_id",
        "c.name as contest_name",
        "c.filled_spots",
        "fg.team_name_user",
        "fg.fantasy_team_id",
        db.raw('COALESCE(lb."totalScore", 0) as total_points'),
        db.raw('COALESCE(lb."rank", NULL) as rank')
      );

    // Get players for each team - USING THE CORRECT APPROACH FROM myMatches
    const teamIds = userTeams.map(t => t.fantasy_team_id);
    let playersByTeamId = {};
    
    if (teamIds.length > 0) {
      // Get tournament season_id for player_teams lookup
      const tournament = await db("tournaments")
        .select("metadata")
        .where("id", match.tournament_id)
        .first();
      
      let seasonId = null;
      if (tournament?.metadata) {
        const tournamentMetadata = typeof tournament.metadata === 'string' 
          ? JSON.parse(tournament.metadata) 
          : tournament.metadata;
        seasonId = tournamentMetadata.season_id;
      }

      // Use the same approach as in myMatches function
      const teamPlayersRows = await db("fantasy_team_players as ftp")
        .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
        .join("matches as m", "ft.match_id", "m.id")
        .leftJoin("match_players as mp", function () {
          this.on("mp.match_id", "m.id").andOn("mp.player_id", "ftp.player_id");
        })
        .join("players as p", "ftp.player_id", "p.id")
        .leftJoin("player_teams as pt", function () {
          this.on("pt.player_id", "p.id")
            .andOn(function () {
              this.on("pt.team_id", "=", "m.team1_id").orOn("pt.team_id", "m.team2_id");
            });
          
          if (seasonId) {
            this.andOn("pt.season_id", "=", seasonId);
          }
        })
        .leftJoin("teams as t", "pt.team_id", "t.id")
        .whereIn("ftp.fantasy_team_id", teamIds)
        .select(
          "ftp.fantasy_team_id",
          "ftp.player_id",
          db.raw("BOOL_OR(ftp.is_captain) as is_captain"),
          db.raw("BOOL_OR(ftp.is_vice_captain) as is_vice_captain"),
          db.raw("BOOL_OR(ftp.substitute) as substitute"),
          "m.id as match_id",
          db.raw("COALESCE(mp.is_playing_xi, false) as is_playing_xi"),
          db.raw("COALESCE(mp.is_substitute, false) as is_substitute"),
          db.raw("COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup"),
          "ftp.points",
          "p.name as player_name",
          "p.role as player_role",
          "p.credits as player_credits",
          "t.id as player_team_id",
          "t.name as player_team_name",
          "t.short_name as player_team_short_name",
          db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
        )
        .groupBy(
          "ftp.fantasy_team_id",
          "ftp.player_id",
          "ftp.points",
          "t.id",
          "mp.id",
          "p.id",
          "m.id"
        );

      const seenKeys = new Set();
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
    }

    

    // Format teams with players and rank
    const teams = userTeams.map(team => {
      const players = playersByTeamId[team.fantasy_team_id] || [];
      const contest = userContests.find(c => c.fantasy_team_id === team.fantasy_team_id);
    
      return {
        fantasy_team_id: team.fantasy_team_id,
        fantasy_team_name: team.fantasy_team_name,
        team_label: team.team_label,
        total_points: Number(team.total_points),
        rank: team.rank, // Include rank
        contest_id: contest ? contest.contest_id : null, // ADD CONTEST ID HERE
        contest_name: contest ? contest.contest_name : null, // Also include contest name if available
        filled_spots: contest ? contest.filled_spots : team.filled_spots, // fallback रखा
        team1_player_count: players.filter(
          p => p.teamId === match.team1_id && !p.substitute
        ).length,
        team2_player_count: players.filter(
          p => p.teamId === match.team2_id && !p.substitute
        ).length
      };
    });
    
    // rank को highest-first (descending) order में sort करना
    const sortedTeams = teams.sort((a, b) => a.rank - b.rank);
    
    const response = {
      sm_match_id: match.sm_match_id,
      contest_id: userContests.length > 0 ? userContests[0].contest_id : null,
      team1_name: match.team1_name,
      team1_short_name: match.team1_short_name,
      team1_logo_url: match.team1_logo_url,
      team2_name: match.team2_name,
      team2_short_name: match.team2_short_name,
      team2_logo_url: match.team2_logo_url,
      tournament_name: match.tournament_name,
      status: match.status,
      start_time: match.start_time,
      end_time: match.end_time,
      created_at: match.created_at,
      updated_at: match.updated_at,
      time_ago: time_ago,
      toss: toss,
      result_note: result_note,
      winner_team: winner_team,
      scorecard:
        typeof match.scorecard === "string"
          ? JSON.parse(match.scorecard)
          : match.scorecard,
      metadata: metadata,
      contest: sortedTeams, // sorted list भेजी
    };
    

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, response);
  } catch (error) {
    console.error("getFinishedMatchDetails error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

// Fetch teams data for a specific match (Teams tab)
async function getMatchTeams(req, res) {
  try {
    const userId = req.user.id;
    const { sm_match_id } = req.body;

    // Query for match and team details
    const match = await db('fantasy_games as fg')
      .join('fantasy_teams as ft', 'fg.fantasy_team_id', 'ft.id')
      .join('matches as m', 'ft.match_id', 'm.id')
      .join('teams as t1', 'm.team1_id', 't1.id')
      .join('teams as t2', 'm.team2_id', 't2.id')
      .where('fg.user_id', userId)
      .where('m.sm_match_id', sm_match_id)
      .whereIn('m.status', ['Finished', 'Completed'])
      .select(
        'm.id as match_id',
        'm.team1_id',
        'm.team2_id',
        't1.logo_url as team1_logo_url',
        't1.short_name as team1_short_name',
        't2.logo_url as team2_logo_url',
        't2.short_name as team2_short_name'
      )
      .first();

    if (!match) {
      return apiResponse.ErrorResponse(res, 'Match not found or user not associated with this match.');
    }

    // Fetch user's fantasy teams for this match
    const userTeams = await db('fantasy_games as fg')
      .join('fantasy_teams as ft', 'fg.fantasy_team_id', 'ft.id')
      .select(
        'ft.id as fantasy_team_id',
        'ft.name as fantasy_team_name',
        'ft.total_points',
        'ft.status as team_status',
        'fg.team_name_user as label'
      )
      .where('fg.user_id', userId)
      .where('ft.match_id', match.match_id);

    const usedTeamsByMatchId = new Map();
    userTeams.forEach((team) => {
      usedTeamsByMatchId.set(team.fantasy_team_id, {
        id: team.fantasy_team_id,
        name: team.fantasy_team_name,
        label: team.label,
        total_points: team.total_points ?? 0,
        team_status: team.team_status ?? 0,
      });
    });

    // Fetch players for the teams
    const teamIds = Array.from(usedTeamsByMatchId.keys());
    let playersByTeamId = {};
    if (teamIds.length > 0) {
      const teamPlayersRows = await db('fantasy_team_players as ftp')
        .join('fantasy_teams as ft', 'ftp.fantasy_team_id', 'ft.id')
        .join('matches as m', 'ft.match_id', 'm.id')
        .leftJoin('match_players as mp', function () {
          this.on('mp.match_id', 'm.id').andOn('mp.player_id', 'ftp.player_id');
        })
        .join('players as p', 'ftp.player_id', 'p.id')
        .leftJoin('player_teams as pt', function () {
          this.on('pt.player_id', 'p.id').andOn(function () {
            this.on('pt.team_id', '=', 'm.team1_id').orOn('pt.team_id', 'm.team2_id');
          });
        })
        .leftJoin('teams as t', 'pt.team_id', 't.id')
        .select(
          'ftp.fantasy_team_id',
          'ftp.player_id',
          db.raw('BOOL_OR(ftp.is_captain) as is_captain'),
          db.raw('BOOL_OR(ftp.is_vice_captain) as is_vice_captain'),
          db.raw('BOOL_OR(ftp.substitute) as substitute'),
          db.raw('COALESCE(mp.is_playing_xi, false) as is_playing_xi'),
          db.raw('COALESCE(mp.is_substitute, false) as is_substitute'),
          db.raw('COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup'),
          'ftp.points',
          'p.name as player_name',
          'p.role as player_role',
          'p.credits as player_credits',
          't.id as player_team_id',
          't.name as player_team_name',
          't.short_name as player_team_short_name',
          db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
        )
        .whereIn('ftp.fantasy_team_id', teamIds)
        .where('ft.match_id', match.match_id)
        .groupBy('ftp.fantasy_team_id', 'ftp.player_id', 'ftp.points', 't.id', 'mp.id', 'p.id', 'm.id');

      playersByTeamId = teamPlayersRows.reduce((acc, row) => {
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
          captain_percentage: '0.00',
          vice_captain_percentage: '0.00',
          in_lineup: row.in_lineup,
          is_playing_xi: row.is_playing_xi,
          is_substitute: row.is_substitute,
        });
        return acc;
      }, {});
    }

    // Calculate team totals
    const teamTotals = {};
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

    // Format teams array
    const teams = Array.from(usedTeamsByMatchId.values()).map((team) => ({
      backup_players: [],
      fantasy_team_id: team.id,
      fantasy_team_name: team.name,
      match_id: match.match_id,
      players: playersByTeamId[team.id] || [],
      team1_id: match.team1_id,
      team1_image: match.team1_logo_url,
      team1_player_count: (playersByTeamId[team.id] || []).filter(
        (p) => p.teamId === match.team1_id && !p.substitute
      ).length,
      team1_short_name: match.team1_short_name,
      team2_id: match.team2_id,
      team2_image: match.team2_logo_url,
      team2_player_count: (playersByTeamId[team.id] || []).filter(
        (p) => p.teamId === match.team2_id && !p.substitute
      ).length,
      team2_short_name: match.team2_short_name,
      team_status: team.team_status,
      total_points: teamTotals[team.id] || 0,
    }));

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, teams);
  } catch (error) {
    console.error('getMatchTeams error:', error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

// Fetch contest leaderboard for a specific contest (Contest card click)
async function getContestLeaderboardWithPagination(req, res) {
  try {
    const userId = req.user.id;
    const { contest_id, page = 1 } = req.body;
    const pageSize = 50; // Show 10 entries per page
    const offset = (page - 1) * pageSize;

    // Get contest details
    const contest = await db("contests as c")
      .join("matches as m", "c.match_id", "m.id")
      .join("teams as t1", "m.team1_id", "t1.id")
      .join("teams as t2", "m.team2_id", "t2.id")
      .where("c.id", contest_id)
      .select(
        "c.*",
        "m.team1_id", // ADD THIS
        "m.team2_id", // ADD THIS
        "m.id as match_id",
        "t1.short_name as team1_short_name",
        "t2.short_name as team2_short_name"
      )
      .first();

    if (!contest) {
      return apiResponse.notFoundResponse(res, "Contest not found");
    }

    // Get total count of entries in this contest
    const totalCount = await db("fantasy_games as fg")
      .where("fg.contest_id", contest_id)
      .count("* as count")
      .first();

    // Get paginated leaderboard entries
    const leaderboardEntries = await db("fantasy_games as fg")
      .join("contests as c", "fg.contest_id", "c.id")
      .leftJoin("leaderboard as lb", "lb.fantasyGameId", "fg.id")
      .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
      .join("users as u", "fg.user_id", "u.id")
      .where("c.id", contest_id)
      .select(
        "fg.fantasy_team_id",
        "fg.team_name_user as team_label",
        "ft.name as fantasy_team_name",
        db.raw('COALESCE(lb."totalScore", 0) as total_points'),
        db.raw('COALESCE(lb."rank", NULL) as rank'),
        "u.name as username",
        "u.image_url as profile_image"
      )
      .orderBy("total_points", "desc")
      .limit(pageSize)
      .offset(offset);

    // Get all fantasy team IDs for player data
    const fantasyTeamIds = leaderboardEntries.map(entry => entry.fantasy_team_id);

    let playersByTeamId = {};
    if (fantasyTeamIds.length > 0) {
      // Get tournament season_id for player_teams lookup
      const tournament = await db("tournaments")
        .select("metadata")
        .where("id", contest.tournament_id)
        .first();
      
      let seasonId = null;
      if (tournament?.metadata) {
        const tournamentMetadata = typeof tournament.metadata === 'string' 
          ? JSON.parse(tournament.metadata) 
          : tournament.metadata;
        seasonId = tournamentMetadata.season_id;
      }

      // Get players for each fantasy team
      const teamPlayersRows = await db("fantasy_team_players as ftp")
        .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
        .join("matches as m", "ft.match_id", "m.id")
        .leftJoin("match_players as mp", function () {
          this.on("mp.match_id", "m.id").andOn("mp.player_id", "ftp.player_id");
        })
        .join("players as p", "ftp.player_id", "p.id")
        .leftJoin("player_teams as pt", function () {
          this.on("pt.player_id", "p.id")
            .andOn(function () {
              this.on("pt.team_id", "=", "m.team1_id").orOn("pt.team_id", "m.team2_id");
            });
          
          if (seasonId) {
            this.andOn("pt.season_id", "=", seasonId);
          }
        })
        .leftJoin("teams as t", "pt.team_id", "t.id")
        .whereIn("ftp.fantasy_team_id", fantasyTeamIds)
        .select(
          "ftp.fantasy_team_id",
          "ftp.player_id",
          db.raw("BOOL_OR(ftp.is_captain) as is_captain"),
          db.raw("BOOL_OR(ftp.is_vice_captain) as is_vice_captain"),
          db.raw("BOOL_OR(ftp.substitute) as substitute"),
          "m.id as match_id",
          db.raw("COALESCE(mp.is_playing_xi, false) as is_playing_xi"),
          db.raw("COALESCE(mp.is_substitute, false) as is_substitute"),
          db.raw("COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup"),
          "ftp.points",
          "p.name as player_name",
          "p.role as player_role",
          "p.credits as player_credits",
          "t.id as player_team_id",
          "t.name as player_team_name",
          "t.short_name as player_team_short_name",
          db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
        )
        .groupBy(
          "ftp.fantasy_team_id",
          "ftp.player_id",
          "ftp.points",
          "t.id",
          "mp.id",
          "p.id",
          "m.id"
        );

      const seenKeys = new Set();
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
    }

    // Format the leaderboard with player data
    let formattedLeaderboard = leaderboardEntries.map(entry => {
      const players = playersByTeamId[entry.fantasy_team_id] || [];
      
      // Count players from each team
      let team1PlayerCount = 0;
      let team2PlayerCount = 0;
      
      players.forEach(player => {
        if (player.teamId === contest.team1_id && !player.substitute) {
          team1PlayerCount++;
        } else if (player.teamId === contest.team2_id && !player.substitute) {
          team2PlayerCount++;
        }
      });
      let profileImageUrl = null;
      if (entry.profile_image) {
        if (entry.profile_image.startsWith('http')) {
          profileImageUrl = entry.profile_image;
        } else {
          profileImageUrl = `${config.baseURL}/${entry.profile_image}`;
        }
      }

      return {
        fantasy_team_id: entry.fantasy_team_id,
        team_label: entry.team_label,
        fantasy_team_name: entry.fantasy_team_name,
        rank: entry.rank,
        points: Number(entry.total_points),
        username: entry.username,
        profile_image: profileImageUrl,
        team1_short_name: contest.team1_short_name,
        team2_short_name: contest.team2_short_name,
        team1_player_count: team1PlayerCount,
        team2_player_count: team2PlayerCount,
        players: players
      };
    });
    formattedLeaderboard = formattedLeaderboard.sort((a, b) => a.rank - b.rank);
    

    const response = {
      contest_id: parseInt(contest_id),
      total: parseInt(totalCount.count),
      list: formattedLeaderboard,
      total_participants: contest.filled_spots || 0,
      pagination: {
        current_page: parseInt(page),
        page_size: pageSize,
        total_pages: Math.ceil(totalCount.count / pageSize),
        total_entries: parseInt(totalCount.count)
      }
    };

    return apiResponse.successResponseWithData(res, SUCCESS.dataFound, response);
  } catch (error) {
    console.error("getContestLeaderboardWithPagination error:", error);
    return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  }
}

module.exports = {
  getMyFinishedMatches,
  getFinishedMatchDetails,
  getMatchTeams,
  getContestLeaderboardWithPagination,
};