const cron = require("node-cron");
const { knex: db } = require("../config/database");
const SportMonksController = require("../controllers/admin/sportmonksController");
const {
  updateLeaderboardForTodayMatches,
} = require("../services/scoreCalculation");
const checkAndSendMatchNotifications = require("./pushNotificationSend");
const { expireOldTransactions } = require("./payment");

// 1. Primary tournament sync: once per day at 2:00 AM
cron.schedule("0 2 * * *", async () => {
  console.log("[CRON] Starting primary tournament sync at", new Date());
  try {
    await SportMonksController.syncAllTournamentData(
      {},
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      }
    );
    console.log("[CRON] Completed primary tournament sync");
  } catch (error) {
    console.error("[CRON] Error in primary tournament sync:", error);
  }
});

// 2. Player update: right after tournament sync at 2:05 AM
cron.schedule("5 2 * * *", async () => {
  console.log("[CRON] Starting player update at", new Date());
  try {
    await SportMonksController.updateAllPlayers(
      {},
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      }
    );
    console.log("[CRON] Completed player updates");
  } catch (error) {
    console.error("[CRON] Error in player updates:", error);
  }
});

// 3. Match notifications: every 1 minute
cron.schedule("* * * * *", async () => {
  console.log("[CRON] Running match notification check at", new Date());
  try {
    await checkAndSendMatchNotifications();
    console.log("[CRON] Completed match notification check");
  } catch (error) {
    console.error("[CRON] Error in match notifications:", error);
  }
});

cron.schedule("*/5 * * * *", async () => {
  try {
    const now = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(now.getDate() - 1);

    const contestsToUpdate = await db("contests")
      // .whereBetween("end_time", [twoDaysAgo, now])
      .andWhere("status", "!=", "completed");

    if (!contestsToUpdate.length) {
      console.log("[CRON] No contests to complete");
      return;
    }

    for (const contest of contestsToUpdate) {
      const match = await db("matches").where({ id: contest.match_id }).first();

      if (!match) {
        console.log(`[CRON] Contest ${contest.id} has no match, skipping`);
        continue;
      }

      if (match.status !== "Finished") {
        console.log(
          `[CRON] Contest ${contest.id} -> match ${match.id} is still ${match.status}`
        );
        continue;
      }

      await db("contests")
        .where({ id: contest.id })
        .update({ status: "completed", updated_at: new Date() });

      const leaderboard = await db("leaderboard")
        .where({ contestId: contest.id })
        .orderBy("rank", "asc");

      if (!leaderboard.length) continue;

      const winnings = contest.winnings || [];
      const team1 = await db("teams").where("id", match.team1_id).first();
      const team2 = await db("teams").where("id", match.team2_id).first();

      const matchTitle =
        team1 && team2
          ? `${team1.short_name} vs ${team2.short_name}`
          : "Unknown Match";

      for (const payoutTier of winnings) {
        const { from, to, price } = payoutTier;

        const winners = leaderboard.filter(
          (row) => row.rank >= from && row.rank <= to
        );

        for (const winner of winners) {
          const winningAmount = price;

          if (winningAmount > 0) {
            await db("wallet")
              .where({ user_id: winner.userId })
              .increment("balance", winningAmount);

            await db("users")
              .where({ id: winner.userId })
              .increment("wallet_balance", winningAmount);

            await db("transactions").insert({
              user_id: winner.userId,
              title: matchTitle,
              amount: winningAmount,
              transactionType: "contest_winning",
              status: "completed",
              currency: "BDT",
              contest_id: contest.id,
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
        }
      }

      console.log(`[CRON] Contest ${contest.id} completed successfully`);
    }
  } catch (error) {
    console.error("[CRON] Error in contest completion:", error);
  }
});

// 5. Live scoreboard refresh: every 5 minutes (spreads API load, avoids clash with match data sync)
cron.schedule("0 */5 * * * *", async () => {
  console.log("[CRON] Starting scoreboard refresh at", new Date());
  try {
    await SportMonksController.updateLiveScoreboards(
      {},
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      }
    );
    console.log("[CRON] Completed scoreboard refresh");
  } catch (error) {
    console.error("[CRON] Error in scoreboard refresh:", error);
  }
});

// 6. Match data & lineups & leaderboard: every 6 minutes at :30s (staggered to avoid collision with scoreboard refresh)
cron.schedule("*/3 * * * *", async () => {
  console.log("[CRON] Starting match data sync at", new Date());
  try {
    await SportMonksController.getFixtureDetails(
      {},
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      }
    );

    // Prefetch upcoming and just-started lineups
    await SportMonksController.syncUpcomingLineups(
      {},
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      }
    );

    await SportMonksController.syncJustStartedLineups(
      {},
      {
        status: () => ({ json: () => {} }),
        json: () => {},
      }
    );

    console.log("[CRON] Completed match data sync (optimized)");
  } catch (error) {
    console.error("[CRON] Error in match data sync:", error);
  }
});

// Lightweight leaderboard refresh (DB only) every 1 minute
cron.schedule("* * * * *", async () => {
  console.log("[CRON] Starting updateLeaderboardForTodayMatches", new Date());
  try {
    await updateLeaderboardForTodayMatches(db);
    console.log("[CRON] Completed updateLeaderboardForTodayMatches");
  } catch (error) {
    console.error("[CRON] Error in updateLeaderboardForTodayMatches", error);
  }
});

// 7. Fast status-only poll for just-started matches: every 3 minutes (tiny scope, API light)
cron.schedule("0 */3 * * * *", async () => {
  console.log("[CRON] Fast just-started status refresh at", new Date());
  try {
    await SportMonksController.refreshJustStartedStatus(
      { query: { past: 15 } }, // last 15 mins window
      { status: () => ({ json: () => {} }), json: () => {} }
    );
  } catch (error) {
    console.error(
      "[CRON] Error in just-started refresh:",
      error?.message || error
    );
  }
});

cron.schedule("*/5 * * * *", expireOldTransactions);
