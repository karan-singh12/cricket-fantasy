const config = require("../config/config");
const { knex: db } = require("../config/database");
 
async function getContestLeaderboardData(contest_id, viewerUserId) {
  // ==== Contest validation ====
  const contest = await db("contests")
    .where("id", contest_id)
    .first();
 
  if (!contest) {
    return { error: "Contest not found" };
  }
 
  // ==== Leaderboard ====
  const leaderboard = await db("leaderboard as lb")
    .select(
      "lb.id",
      "lb.totalScore as total_points",
      "lb.rank",
      "u.id as user_id",
      "u.name as user_name",
      "u.image_url",
      "ft.id as fantasy_team_id",
      "ft.name as team_name",
      "ft.total_points as fantasy_team_points",
      "ft.status as team_status",
      "fg.team_name_user"
    )
    .join("users as u", "lb.userId", "u.id")
    .join("fantasy_games as fg", "lb.fantasyGameId", "fg.id")
    .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
    .where("lb.contestId", contest_id)
    .orderBy("lb.rank", "asc");
 
  if (!leaderboard.length) {
    return { error: "No leaderboard data" };
  }
 
  // ==== Followers / Following ====
  const userIds = leaderboard.map((entry) => entry.user_id);
 
  // ==== Lineup map for the contest's match ====
  const matchIdForContest = contest.match_id;
  const matchInfo = await db("matches as m")
    .leftJoin("teams as t1", "m.team1_id", "t1.id")
    .leftJoin("teams as t2", "m.team2_id", "t2.id")
    .select(
      "m.id as match_id",
      "m.team1_id",
      "m.team2_id",
      "m.status",
      "t1.short_name as team1_short_name",
      "t2.short_name as team2_short_name",
      "t1.logo_url as team1_image",
      "t2.logo_url as team2_image"
    )
    .where("m.id", matchIdForContest)
    .first();
  const lineupRows = await db("match_players")
    .where({ match_id: matchIdForContest })
    .select("player_id", "is_playing_xi", "is_substitute");
  const lineupMap = new Map(
    lineupRows.map((r) => [Number(r.player_id), { inXI: !!r.is_playing_xi, isSub: !!r.is_substitute }])
  );
 
  // ==== Players of fantasy teams ====
  const fantasyTeamIds = leaderboard.map((entry) => entry.fantasy_team_id);
  let playersByTeamId = {};
  if (fantasyTeamIds.length > 0) {
    // Total fantasy teams for this match (denominator for percentages)
    const [{ count: totalTeamsCountRaw } = { count: 0 }] = await db("fantasy_teams")
      .where({ match_id: matchIdForContest })
      .countDistinct("id as count");
    const totalTeamsCount = Number(totalTeamsCountRaw) || 0;
 
    // Captain/Vice-captain counts per player for this match
    const capStatsRows = await db("fantasy_team_players as ftp")
      .join("fantasy_teams as ft", "ftp.fantasy_team_id", "ft.id")
      .where("ft.match_id", matchIdForContest)
      .groupBy("ftp.player_id")
      .select(
        "ftp.player_id",
        db.raw("SUM(CASE WHEN ftp.is_captain THEN 1 ELSE 0 END) as captain_count"),
        db.raw(
          "SUM(CASE WHEN ftp.is_vice_captain THEN 1 ELSE 0 END) as vice_captain_count"
        )
      );
    const capStatsMap = capStatsRows.reduce((acc, row) => {
      acc[row.player_id] = {
        captain_count: Number(row.captain_count) || 0,
        vice_captain_count: Number(row.vice_captain_count) || 0,
      };
      return acc;
    }, {});
 
    const teamPlayersRows = await db("fantasy_team_players as ftp")
      .join("fantasy_teams as ft2", "ftp.fantasy_team_id", "ft2.id")
      .join("matches as mm", "ft2.match_id", "mm.id")
      .leftJoin("player_stats as ps", function () {
        this.on("ps.match_id", "mm.id").andOn("ps.player_id", "ftp.player_id");
      })
      .leftJoin("match_players as mp", function () {
        this.on("mp.match_id", "mm.id").andOn("mp.player_id", "ftp.player_id");
      })
      .join("players as p", "ftp.player_id", "p.id")
      .leftJoin("player_teams as pt", function () {
        this.on("p.id", "pt.player_id").andOn(function () {
          this.on("pt.team_id", "=", "mm.team1_id").orOn(
            "pt.team_id",
            "=",
            "mm.team2_id"
          );
        });
      })
      .leftJoin("teams as t", "pt.team_id", "t.id")
      .select(
        "ftp.fantasy_team_id",
        "ftp.player_id",
        "ftp.is_captain",
        "ftp.is_vice_captain",
        "ftp.substitute",
        "ftp.points",
        db.raw("COALESCE(ps.fantasy_points, 0) as fantasy_point"),
        db.raw("COALESCE(mp.is_playing_xi, false) as is_playing_xi"),
        db.raw("COALESCE(mp.is_substitute, false) as is_substitute"),
        db.raw(
          "COALESCE(mp.is_playing_xi, false) OR COALESCE(mp.is_substitute, false) as in_lineup"
        ),
        "p.name as player_name",
        "p.role as player_role",
        "t.id as player_team_id",
        "t.name as player_team_name",
        "t.short_name as player_team_short_name",
        db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
      )
      .whereIn("ftp.fantasy_team_id", fantasyTeamIds);
 
    const seen = new Set();
    playersByTeamId = teamPlayersRows.reduce((acc, row) => {
      const key = `${row.fantasy_team_id}:${row.player_id}`;
      if (seen.has(key)) return acc;
      seen.add(key);
      const capCounts = capStatsMap[row.player_id] || {
        captain_count: 0,
        vice_captain_count: 0,
      };
 
      const captain_percentage = totalTeamsCount > 0 ? ((capCounts.captain_count / totalTeamsCount) * 100).toFixed(2) : "0.00";
 
      const vice_captain_percentage = totalTeamsCount > 0 ? ((capCounts.vice_captain_count / totalTeamsCount) * 100).toFixed(2) : "0.00";
 
      if (!acc[row.fantasy_team_id]) acc[row.fantasy_team_id] = [];
      acc[row.fantasy_team_id].push({
        id: row.player_id,
        player_id: row.player_id,
        name: row.player_name,
        role: row.player_role,
        is_captain: row.is_captain,
        is_vice_captain: row.is_vice_captain,
        substitute: row.substitute,
        in_lineup: row.in_lineup,
        is_playing_xi: row.is_playing_xi,
        is_substitute: row.is_substitute,
        teamId: row.player_team_id,
        team_short_name: row.player_team_short_name,
        team: row.player_team_name,
        imagePath: row.image_path ? row.image_path : "",
        fantasy_point: Number(row.points),
        captain_percentage,
        vice_captain_percentage,
      });
      return acc;
    }, {});
  }
 
  const [followersCounts, followingCounts, followingStatus] = await Promise.all([
    db("follow_unfollow")
      .whereIn("following_id", userIds)
      .select("following_id")
      .count("* as count")
      .groupBy("following_id"),
    db("follow_unfollow")
      .whereIn("follower_id", userIds)
      .select("follower_id")
      .count("* as count")
      .groupBy("follower_id"),
    db("follow_unfollow")
      .where("follower_id", viewerUserId)
      .whereIn("following_id", userIds)
      .select("following_id")
  ]);
 
  const followersMap = new Map(followersCounts.map((f) => [f.following_id, parseInt(f.count)]));
  const followingMap = new Map(followingCounts.map((f) => [f.follower_id, parseInt(f.count)]));
  const followingSet = new Set(followingStatus.map((f) => f.following_id));
 
  // ==== Career Stats ====
  const careerStats = await db("users as u")
    .leftJoin("fantasy_teams as ft", "u.id", "ft.user_id")
    .leftJoin("leaderboard as l", "u.id", db.raw('"l"."userId"'))
    .leftJoin("contests as c", db.raw('"l"."contestId"'), "c.id")
    .whereIn("u.id", userIds)
    .groupBy("u.id")
    .select(
      "u.id as user_id",
 
      db.raw('COUNT(DISTINCT "l"."contestId") as contests_played'),
      db.raw("COUNT(DISTINCT ft.match_id) as matches_played"),
      db.raw("COUNT(DISTINCT c.tournament_id) as series_played"),
 
      db.raw(`
      SUM(
        CASE
          WHEN "l"."rank" = 1 AND c.winnings IS NOT NULL THEN
            (c.winnings->>'1')::numeric
          WHEN "l"."rank" = 2 AND c.winnings IS NOT NULL THEN
            (c.winnings->>'2')::numeric
          WHEN "l"."rank" = 3 AND c.winnings IS NOT NULL THEN
            (c.winnings->>'3')::numeric
          ELSE 0
        END
      ) as total_winnings
    `),
 
      db.raw('COUNT(DISTINCT CASE WHEN "l"."rank" = 1 THEN "l"."contestId" END) as contests_won'),
      db.raw('MIN("l"."rank") as best_rank'),
      db.raw("SUM(ft.total_points) as total_points")
    );
 
 
 
 
  const careerStatsMap = new Map();
  careerStats.forEach((stat) => {
    const contestsPlayed = parseInt(stat.contests_played) || 0;
    careerStatsMap.set(stat.user_id, {
      contests: {
        total: contestsPlayed,
        won: parseInt(stat.contests_won) || 0,
        winPercentage: contestsPlayed > 0
          ? Math.round((parseInt(stat.contests_won) / contestsPlayed * 100))
          : 0,
        totalWinnings: parseFloat(stat.total_winnings) || 0,
      },
      matches: {
        total: parseInt(stat.matches_played) || 0,
        totalPoints: parseFloat(stat.total_points) || 0,
        bestRank: stat.best_rank ? parseInt(stat.best_rank) : null,
      },
      series: {
        total: parseInt(stat.series_played) || 0,
      },
    });
  });
 
  // ==== Final format ====
  const formattedLeaderboard = leaderboard.map((entry) => ({
    id: entry.user_id,
    team_create_by_user: entry.team_name_user,
    team_name: entry.team_name,
    user_name: entry.user_name,
    image_url: entry.image_url ? `${config.baseURL}/${entry.image_url}` : "",
    total_points: entry.total_points,
    rank: entry.rank,
    followers_count: followersMap.get(entry.user_id) || 0,
    following_count: followingMap.get(entry.user_id) || 0,
    isFollowing: followingSet.has(entry.user_id),
    fantasy_team: (() => {
      const isOwner = entry.user_id === viewerUserId;
      const hasMatchStarted = matchInfo.status !== "NS";
 
      const canSeePlayers = isOwner || hasMatchStarted;
      const players = canSeePlayers ? (playersByTeamId[entry.fantasy_team_id] || []) : [];
      const team1Count = players.filter((p) => p.teamId === matchInfo.team1_id && !p.substitute).length;
      const team2Count = players.filter((p) => p.teamId === matchInfo.team2_id && !p.substitute).length;
      return {
        backup_players: [],
        fantasy_team_id: entry.fantasy_team_id,
        fantasy_team_name: entry.team_name,
        match_id: matchInfo.match_id,
        players,
        team1_id: matchInfo.team1_id,
        team1_image: matchInfo.team1_image,
        team1_player_count: team1Count,
        team1_short_name: matchInfo.team1_short_name,
        team2_id: matchInfo.team2_id,
        team2_image: matchInfo.team2_image,
        team2_player_count: team2Count,
        team2_short_name: matchInfo.team2_short_name,
        team_status: entry.team_status ?? 0,
        total_points: entry.fantasy_team_points ?? 0,
      };
    })(),
    careerStats: careerStatsMap.get(entry.user_id) || {
      contests: { total: 0, won: 0, winPercentage: 0, totalWinnings: 0 },
      matches: { total: 0, totalPoints: 0, bestRank: null },
      series: { total: 0 }
    },
  }));
 
 
  return {
    data: formattedLeaderboard,
    is_finalized: contest.status === "completed"
  };
}
 
module.exports = { getContestLeaderboardData };