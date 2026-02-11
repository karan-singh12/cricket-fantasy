const config = require("../config/config");
const mongoose = require("mongoose");
const moment = require("moment");
const Match = require("../models/Match");
const Contest = require("../models/Contest");
const FantasyGame = require("../models/FantasyGame");
const Notification = require("../models/Notification");
const Team = require("../models/Team");
const Tournament = require("../models/Tournament");

async function getUserMatches(userId, type = "all", matchId = null) {
  try {
    const statusFilter = getStatusFilter(type);

    // 1. Find User's Matches first (via FantasyGame entries)
    // Start with finding FantasyGame for user
    // Then pluck unique Match IDs.
    // Then filter Matches by status.

    // SQL query joined Matches directly. Meaning it fetches matches the user has joined teams for?
    // "fg.user_id = userId"
    // Yes.

    const userEntries = await FantasyGame.find({ user: userId })
      .populate({
        path: "contest",
        select: "match"
      });

    const matchIdsSet = new Set();
    userEntries.forEach(fg => {
      if (fg.contest?.match) matchIdsSet.add(fg.contest.match.toString()); // contest.match is usually ObjectId
      // What if user created team but didn't join contest?
      // SQL query joined `fantasy_teams` as well?
      // "fantasy_games as fg join fantasy_teams ... ft.match_id"
      // Wait, FantasyGame links to Contest -> Match.
      // FantasyTeam links to Match directly.
      // The SQL query used `ft.match_id`. So it includes matches where user created a team?
      // Ah, `fg.user_id = userId`. So user MUST have joined a contest (entry).
      // But `fg.fantasy_team_id` links to `ft`.

      // Actually, users might have teams but not joined contests.
      // `getUserMatches` usually shows matches where user has PARTICIPATED (joined contest).
      // Or just created team?
      // "fg.user_id" implies Participation in Contest.
    });

    // Check query again:
    // `db("fantasy_games as fg")...where("fg.user_id", userId)`
    // So yes, matches where user has joined a contest.

    // But wait, `matches.js` also has logic for `myMatches` socket event.
    // Does it show matches where user created team but not joined?
    // Typically "My Matches" = Joined Contests.

    const matchIds = Array.from(matchIdsSet);

    // 2. Query Matches with filters
    const matchQuery = { _id: { $in: matchIds } };
    if (matchId) matchQuery._id = matchId;
    if (statusFilter) matchQuery.status = { $in: statusFilter };

    const matches = await Match.find(matchQuery)
      .populate("team1", "name short_name logo_url")
      .populate("team2", "name short_name logo_url")
      .populate("tournament", "name season_id") // populate tournament
      .sort({ start_time: -1 });

    if (!matches.length) return [];

    // 3. Notification Check
    // Using Notification model
    const notifications = await Notification.find({
      user: userId,
      // match? Assuming I added match field or legacy check.
      // If not, mock false.
    });
    // Map logic...

    // 4. Contest Counts per Match
    // Aggregate Contest collection
    const contestCounts = await Contest.aggregate([
      { $match: { match: { $in: matches.map(m => m._id) } } },
      { $group: { _id: "$match", count: { $sum: 1 } } }
    ]);
    const contestCountMap = {};
    contestCounts.forEach(c => contestCountMap[c._id.toString()] = c.count);

    // 5. User's Team Counts per Match
    // Aggregate FantasyTeam collection (user created teams)
    const teamCounts = await FantasyGame.aggregate([ // Count ENTRIES? Or TEAMS?
      // SQL said `count("fg.id as teams_count")`.
      // So number of joined contests?
      // Or number of teams created for that match?
      // "fg.fantasy_team_id" joined.
      // Group by match.
      // Let's count joined contests per match.
      // Determine matches from contests.
      {
        $lookup: { from: "contests", localField: "contest", foreignField: "_id", as: "contest_doc" }
      },
      { $unwind: "$contest_doc" },
      { $match: { user: new mongoose.Types.ObjectId(userId), "contest_doc.match": { $in: matches.map(m => m._id) } } },
      { $group: { _id: "$contest_doc.match", count: { $sum: 1 } } }
    ]);
    const userTeamsCountMap = {};
    teamCounts.forEach(t => userTeamsCountMap[t._id.toString()] = t.count);

    // 6. Detailed Entry Data (for "contets" list in response)
    // Need to fetch FantasyGames for these matches, populate details.
    // Group by Match -> Contest.

    const entries = await FantasyGame.find({ user: userId })
      .populate({
        path: "contest",
        populate: { path: "match" }
      })
      .populate("fantasy_team")
      .populate("user")
      .lean();

    const entriesByMatch = {};
    entries.forEach(entry => {
      const mId = entry.contest?.match?._id?.toString();
      if (!mId) return;
      if (!entriesByMatch[mId]) entriesByMatch[mId] = [];
      entriesByMatch[mId].push(entry);
    });

    // Format Response
    const results = matches.map(match => {
      const mId = match._id.toString();

      // Notifications
      // const isNotif = ... Check notifications list

      // Contest Entries List
      const matchEntries = entriesByMatch[mId] || [];
      const contestList = matchEntries.map(e => ({
        contest_id: e.contest?._id,
        fantasy_team_id: e.fantasy_team?._id,
        fantasy_team_name: e.fantasy_team?.name,
        points: e.points || e.fantasy_team?.total_points || 0,
        filled_spots: e.contest?.joined_teams,
        rank: e.rank,
        // leaderboard: [] // heavy to fetch peers here
      }));

      return {
        id: match._id,
        match_id: match.sportmonks_id,
        team1_name: match.team1?.name,
        team1_short_name: match.team1?.short_name,
        team1_logo_url: match.team1?.logo_url,
        team2_name: match.team2?.name,
        team2_short_name: match.team2?.short_name,
        team2_logo_url: match.team2?.logo_url,
        start_time: match.start_time,
        status: match.status,
        tournament_name: match.tournament?.name,
        time_ago: moment(match.start_time).fromNow(),
        total_contest: contestCountMap[mId] || 0,
        total_teams: userTeamsCountMap[mId] || 0,
        // is_match_notification
        contets: {
          total: contestList.length,
          list: contestList,
          total_participants: 0 // Stubbed
        }
      };
    });

    return results;

  } catch (error) {
    console.error("getUserMatches error:", error);
    return [];
  }
}

function getStatusFilter(type) {
  switch (type.toLowerCase()) {
    case "started":
    case "live":
      return ["1st Innings", "2nd Innings", "3rd Innings", "4th Innings", "Lives", "Live", "Innings Break"];
    case "finished":
    case "completed":
      return ["Finished", "Completed"];
    case "ns":
    case "notstarted":
      return ["NS", "Not Started", "Delayed"];
    case "all":
      return null;
    default:
      return [type];
  }
}

module.exports = { getUserMatches };
