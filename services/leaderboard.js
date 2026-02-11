const config = require("../config/config");
const mongoose = require("mongoose");
const Contest = require("../models/Contest");
const FantasyGame = require("../models/FantasyGame");
const Match = require("../models/Match");
const FollowUnfollow = require("../models/FollowUnfollow");
const MatchPlayer = require("../models/MatchPlayer");
const Player = require("../models/Player");
const User = require("../models/User");

async function getContestLeaderboardData(contest_id, viewerUserId) {
  try {
    const contest = await Contest.findById(contest_id);
    if (!contest) return { error: "Contest not found" };

    const match = await Match.findById(contest.match)
      .populate("team1", "name short_name logo_url")
      .populate("team2", "name short_name logo_url");

    if (!match) return { error: "Match not found" };

    // Fetch Leaderboard (FantasyGame entries)
    const entries = await FantasyGame.find({ contest: contest_id, status: { $ne: 'deleted' } })
      .populate("user", "name username image_url") // User details
      .populate({
        path: "fantasy_team",
        select: "name total_points match status players",
        populate: {
          path: "players.player",
          select: "name role image_url credits" // Need team?
        }
      })
      .sort({ rank: 1, points: -1 })
      .lean();

    if (!entries.length) return { error: "No leaderboard data" };

    const userIds = entries.map(e => e.user?._id);

    // Lineups (MatchPlayer)
    const lineup = await MatchPlayer.find({ match: match._id })
      .select("player is_playing_xi is_substitute")
      .lean();

    const lineupMap = new Map();
    lineup.forEach(l => {
      lineupMap.set(l.player.toString(), { inXI: l.is_playing_xi, isSub: l.is_substitute });
    });

    // Captain Stats (Global for match)
    // Aggregate all teams for this match
    const capStatsAgg = await FantasyGame.find({ contest: contest_id }) // Scope to contest or match? SQL scoped to Match.
      // SQL: join fantasy_teams where match_id = matchIdForContest.
      // It calculated percentages based on ALL teams in the match (across all contests).
      .populate("fantasy_team")
      .lean(); // Use simple find-populate to iterate or aggregate from FantasyTeam collection.

    // Better: Aggregate FantasyTeam collection for this match
    const totalTeamsCount = await FantasyTeam.countDocuments({ match: match._id });

    const capStats = await FantasyTeam.aggregate([
      { $match: { match: match._id } },
      { $unwind: "$players" },
      {
        $group: {
          _id: "$players.player",
          capCount: { $sum: { $cond: ["$players.is_captain", 1, 0] } },
          vcCount: { $sum: { $cond: ["$players.is_vice_captain", 1, 0] } }
        }
      }
    ]);
    const capStatsMap = {};
    capStats.forEach(s => {
      capStatsMap[s._id.toString()] = {
        cap: totalTeamsCount > 0 ? ((s.capCount / totalTeamsCount) * 100).toFixed(2) : "0.00",
        vc: totalTeamsCount > 0 ? ((s.vcCount / totalTeamsCount) * 100).toFixed(2) : "0.00"
      };
    });

    // Followers/Following
    const followersCount = await FollowUnfollow.aggregate([
      { $match: { following: { $in: userIds }, status: 1 } },
      { $group: { _id: "$following", count: { $sum: 1 } } }
    ]);
    const followingCount = await FollowUnfollow.aggregate([
      { $match: { follower: { $in: userIds }, status: 1 } },
      { $group: { _id: "$follower", count: { $sum: 1 } } }
    ]);
    const isFollowingDocs = await FollowUnfollow.find({ follower: viewerUserId, following: { $in: userIds }, status: 1 });
    const followingSet = new Set(isFollowingDocs.map(f => f.following.toString()));

    const followersMap = {};
    followersCount.forEach(f => followersMap[f._id.toString()] = f.count);
    const followingMap = {};
    followingCount.forEach(f => followingMap[f._id.toString()] = f.count);

    // Helper: Career Stats (Simplified for now)
    // SQL query was very heavy. 
    // We can fetch user wins/matches from User model if we store stats there? (No stats in User schema yet)
    // Or aggregate FantasyGame.
    // For speed, let's omit detailed career stats breakdown or provide zeroes for now, 
    // as aggregating all history for every user in leaderboard is expensive in Mongoose loop.
    // Correct approach: Store stats in User model and update via triggers/jobs.
    // I'll provide stubbed career stats.

    const formattedLeaderboard = entries.map(entry => {
      const user = entry.user;
      const ft = entry.fantasy_team;
      if (!user || !ft) return null;

      const isOwner = user._id.toString() === viewerUserId?.toString();
      const hasMatchStarted = match.status !== "NS";
      const canSeePlayers = isOwner || hasMatchStarted;

      let players = [];
      let team1Count = 0;
      let team2Count = 0;

      if (canSeePlayers && ft.players) {
        players = ft.players.map(pData => {
          const p = pData.player; // populated
          if (!p) return null;

          const lineupInfo = lineupMap.get(p._id.toString()) || { inXI: false, isSub: false };

          // Team ID? Need to know which team player belongs to.
          // We can infer from match teams? Or populate team in Player?
          // Assuming we don't have team info readily available without fetching PlayerTeam.
          // Logic: check p.team (if added to schema) or skip team counts for now.
          // SQL had team1Count/team2Count.

          return {
            id: p._id,
            player_id: p._id,
            name: p.name,
            role: p.role,
            imagePath: p.image_url,
            is_captain: pData.is_captain,
            is_vice_captain: pData.is_vice_captain,
            substitute: pData.is_substitute,
            in_lineup: lineupInfo.inXI || lineupInfo.isSub,
            is_playing_xi: lineupInfo.inXI,
            is_substitute: lineupInfo.isSub,
            captain_percentage: capStatsMap[p._id.toString()]?.cap || "0.00",
            vice_captain_percentage: capStatsMap[p._id.toString()]?.vc || "0.00",
            // teamId: ...
          };
        }).filter(Boolean);
      }

      return {
        id: user._id,
        user_name: user.name || user.username,
        image_url: user.image_url ? `${config.baseURL}/${user.image_url}` : "", // format
        total_points: entry.points || ft.total_points || 0,
        rank: entry.rank,
        followers_count: followersMap[user._id.toString()] || 0,
        following_count: followingMap[user._id.toString()] || 0,
        isFollowing: followingSet.has(user._id.toString()),
        fantasy_team: {
          fantasy_team_id: ft._id,
          fantasy_team_name: ft.name,
          match_id: match._id,
          players,
          team1_id: match.team1?._id,
          team1_image: match.team1?.logo_url,
          team1_short_name: match.team1?.short_name,
          // team1_player_count
          team2_id: match.team2?._id,
          team2_image: match.team2?.logo_url,
          team2_short_name: match.team2?.short_name,
          // team2_player_count
          team_status: ft.status,
          total_points: ft.total_points
        },
        careerStats: { // Stubbed
          contests: { total: 0, won: 0, winPercentage: 0, totalWinnings: 0 },
          matches: { total: 0, totalPoints: 0, bestRank: null },
          series: { total: 0 }
        }
      };
    }).filter(Boolean);

    return {
      data: formattedLeaderboard,
      is_finalized: contest.status === "completed"
    };

  } catch (error) {
    console.error("getContestLeaderboardData error:", error);
    return { error: "Something went wrong" };
  }
}

module.exports = { getContestLeaderboardData };