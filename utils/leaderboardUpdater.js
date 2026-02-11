const Match = require("../models/Match");
const Contest = require("../models/Contest");
const FantasyGame = require("../models/FantasyGame");
const FantasyTeam = require("../models/FantasyTeam");
const { updateLeaderboardForMatch, handleMatchDataChange } = require("../socket/socket");

/**
 * Utility class for updating leaderboards
 */
class LeaderboardUpdater {

  /**
   * Update leaderboard for a specific match
   * @param {string} matchId - The match ID
   * @param {string} contestId - Optional contest ID
   * @returns {Promise<Object>} Update result
   */
  static async updateForMatch(matchId, contestId = null) {
    try {
      console.log(`🔄 LeaderboardUpdater: Updating leaderboard for match ${matchId}`);

      if (!matchId) {
        throw new Error("Match ID is required");
      }

      const result = await updateLeaderboardForMatch(matchId, contestId);

      if (result.success) {
        console.log(`✅ LeaderboardUpdater: Successfully updated leaderboard for match ${matchId}`);
      } else {
        console.error(`❌ LeaderboardUpdater: Failed to update leaderboard for match ${matchId}: ${result.message}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error updating leaderboard for match ${matchId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle match data change and trigger leaderboard update
   * @param {string} matchId - The match ID
   * @param {string} changeType - Type of change (e.g., 'score_update', 'player_out', 'wicket')
   * @returns {Promise<Object>} Update result
   */
  static async handleMatchDataChange(matchId, changeType = 'score_update') {
    try {
      console.log(`🔄 LeaderboardUpdater: Handling match data change for match ${matchId}, type: ${changeType}`);

      if (!matchId) {
        throw new Error("Match ID is required");
      }

      const result = await handleMatchDataChange(matchId, changeType);

      if (result.success) {
        console.log(`✅ LeaderboardUpdater: Successfully handled match data change for match ${matchId}`);
      } else {
        console.error(`❌ LeaderboardUpdater: Failed to handle match data change for match ${matchId}: ${result.message}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error handling match data change for match ${matchId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update leaderboards for all live matches
   * @returns {Promise<Object>} Update result
   */
  static async updateAllLiveMatches() {
    try {
      console.log("🔄 LeaderboardUpdater: Updating leaderboards for all live matches");

      const liveMatches = await Match.find({ status: { $regex: /live/i } }).select('_id');

      if (!liveMatches.length) {
        console.log("ℹ️ LeaderboardUpdater: No live matches found");
        return { success: true, message: "No live matches found", updatedMatches: 0 };
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const match of liveMatches) {
        try {
          const result = await updateLeaderboardForMatch(match._id);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push({ matchId: match._id, error: result.message });
          }
        } catch (error) {
          errorCount++;
          errors.push({ matchId: match._id, error: error.message });
        }
      }

      const result = {
        success: errorCount === 0,
        message: `Updated ${successCount} matches, ${errorCount} errors`,
        updatedMatches: successCount,
        errorCount,
        errors: errorCount > 0 ? errors : []
      };

      console.log(`✅ LeaderboardUpdater: Completed updating ${successCount} matches with ${errorCount} errors`);
      return result;

    } catch (error) {
      console.error("❌ LeaderboardUpdater: Error updating all live matches:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update leaderboard for a specific contest
   * @param {string} contestId - The contest ID
   * @returns {Promise<Object>} Update result
   */
  static async updateForContest(contestId) {
    try {
      console.log(`🔄 LeaderboardUpdater: Updating leaderboard for contest ${contestId}`);

      if (!contestId) {
        throw new Error("Contest ID is required");
      }

      const contest = await Contest.findById(contestId);

      if (!contest) {
        throw new Error("Contest not found");
      }

      if (contest.match) {
        // Single match contest
        return await updateLeaderboardForMatch(contest.match, contestId);
      } else {
        // This part might need adjustment if contest can span tournament without a match ref
        // For now, mirroring original logic's tournament support if applicable
        return { success: false, message: "Contest match relationship not clear" };
      }

    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error updating leaderboard for contest ${contestId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Force refresh leaderboard ranks for a match
   * @param {string} matchId - The match ID
   * @returns {Promise<Object>} Update result
   */
  static async refreshRanks(matchId) {
    try {
      console.log(`🔄 LeaderboardUpdater: Refreshing ranks for match ${matchId}`);

      if (!matchId) {
        throw new Error("Match ID is required");
      }

      // Find all contests for this match
      const contests = await Contest.find({ match: matchId }).select('_id');
      if (!contests.length) {
        return { success: true, message: "No contests found for this match" };
      }

      let totalUpdated = 0;

      for (const contest of contests) {
        const entries = await FantasyGame.find({ contest: contest._id })
          .sort({ points: -1, created_at: 1 });

        if (!entries.length) continue;

        let rank = 1;
        for (const entry of entries) {
          await FantasyGame.findByIdAndUpdate(entry._id, {
            rank,
            updated_at: new Date()
          });
          rank++;
          totalUpdated++;
        }
      }

      console.log(`✅ LeaderboardUpdater: Successfully refreshed ranks for match ${matchId}`);
      return {
        success: true,
        message: `Refreshed ranks for ${totalUpdated} entries across ${contests.length} contests`,
        updatedEntries: totalUpdated
      };

    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error refreshing ranks for match ${matchId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get current leaderboard for a contest (within a match context)
   * @param {string} matchId - The match ID
   * @param {string} contestId - The contest ID
   * @returns {Promise<Object>} Leaderboard data
   */
  static async getLeaderboard(matchId, contestId) {
    try {
      if (!contestId) {
        throw new Error("Contest ID is required");
      }

      const leaderboard = await FantasyGame.find({ contest: contestId })
        .populate("user", "name image_url")
        .populate("fantasy_team", "name")
        .sort({ points: -1, created_at: 1 })
        .lean();

      return {
        success: true,
        leaderboard: leaderboard.map(l => ({
          ...l,
          id: l._id,
          user_name: l.user?.name,
          image_url: l.user?.image_url,
          team_name: l.fantasy_team?.name,
          totalScore: l.points
        })),
        matchId,
        contestId,
        totalEntries: leaderboard.length
      };

    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error getting leaderboard:`, error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = LeaderboardUpdater; 