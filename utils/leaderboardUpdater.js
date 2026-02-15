const { knex: db } = require("../config/database");
const { updateLeaderboardForMatch, handleMatchDataChange } = require("../socket/socket");

/**
 * Utility class for updating leaderboards
 */
class LeaderboardUpdater {
  
  /**
   * Update leaderboard for a specific match
   * @param {number} matchId - The match ID
   * @param {number} contestId - Optional contest ID
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
   * @param {number} matchId - The match ID
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
      
      const liveMatches = await db('matches')
        .where('status', 'live')
        .select('id');

      if (!liveMatches.length) {
        console.log("ℹ️ LeaderboardUpdater: No live matches found");
        return { success: true, message: "No live matches found", updatedMatches: 0 };
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const match of liveMatches) {
        try {
          const result = await updateLeaderboardForMatch(match.id);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push({ matchId: match.id, error: result.message });
          }
        } catch (error) {
          errorCount++;
          errors.push({ matchId: match.id, error: error.message });
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
   * @param {number} contestId - The contest ID
   * @returns {Promise<Object>} Update result
   */
  static async updateForContest(contestId) {
    try {
      console.log(`🔄 LeaderboardUpdater: Updating leaderboard for contest ${contestId}`);
      
      if (!contestId) {
        throw new Error("Contest ID is required");
      }

      // Get all matches for this contest
      const contest = await db('contests')
        .where('id', contestId)
        .first();

      if (!contest) {
        throw new Error("Contest not found");
      }

      if (contest.match_id) {
        // Single match contest
        return await updateLeaderboardForMatch(contest.match_id, contestId);
      } else {
        // Tournament contest - update all matches
        const matches = await db('matches')
          .where('tournament_id', contest.tournament_id)
          .select('id');

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const match of matches) {
          try {
            const result = await updateLeaderboardForMatch(match.id, contestId);
            if (result.success) {
              successCount++;
            } else {
              errorCount++;
              errors.push({ matchId: match.id, error: result.message });
            }
          } catch (error) {
            errorCount++;
            errors.push({ matchId: match.id, error: error.message });
          }
        }

        return {
          success: errorCount === 0,
          message: `Updated ${successCount} matches for contest, ${errorCount} errors`,
          updatedMatches: successCount,
          errorCount,
          errors: errorCount > 0 ? errors : []
        };
      }
      
    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error updating leaderboard for contest ${contestId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Force refresh leaderboard ranks for a match
   * @param {number} matchId - The match ID
   * @returns {Promise<Object>} Update result
   */
  static async refreshRanks(matchId) {
    try {
      console.log(`🔄 LeaderboardUpdater: Refreshing ranks for match ${matchId}`);
      
      if (!matchId) {
        throw new Error("Match ID is required");
      }

      // Get all leaderboard entries for this match
      const entries = await db('leaderboard')
        .where({ matchId: matchId })
        .orderBy('totalScore', 'desc');

      if (!entries.length) {
        return { success: true, message: "No leaderboard entries found for this match" };
      }

      let rank = 1;
      for (const entry of entries) {
        await db('leaderboard')
          .where({ id: entry.id })
          .update({ 
            rank, 
            modified_at: new Date() 
          });
        rank++;
      }

      console.log(`✅ LeaderboardUpdater: Successfully refreshed ranks for match ${matchId}`);
      return { 
        success: true, 
        message: `Refreshed ranks for ${entries.length} entries`,
        updatedEntries: entries.length
      };
      
    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error refreshing ranks for match ${matchId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get current leaderboard for a match
   * @param {number} matchId - The match ID
   * @returns {Promise<Object>} Leaderboard data
   */
  static async getLeaderboard(matchId) {
    try {
      if (!matchId) {
        throw new Error("Match ID is required");
      }

      const leaderboard = await db("leaderboard")
        .select(
          "leaderboard.*",
          "users.name as user_name",
          "users.image_url",
          "fantasy_teams.name as team_name"
        )
        .leftJoin("users", "leaderboard.userId", "users.id")
        .leftJoin("fantasy_teams", "leaderboard.fantasyGameId", "fantasy_teams.id")
        .where("leaderboard.matchId", matchId)
        .orderBy("leaderboard.totalScore", "desc");

      return {
        success: true,
        leaderboard,
        matchId,
        totalEntries: leaderboard.length
      };
      
    } catch (error) {
      console.error(`❌ LeaderboardUpdater: Error getting leaderboard for match ${matchId}:`, error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = LeaderboardUpdater; 