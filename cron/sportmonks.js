const cron = require("node-cron");
const mongoose = require("mongoose");
const SportMonksController = require("../controllers/admin/sportmonksController");
const Contest = require("../models/Contest");
const Match = require("../models/Match");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { updateLeaderboardForTodayMatches } = require("../services/scoreCalculation");
const checkAndSendMatchNotifications = require("./pushNotificationSend");
const { expireOldTransactions } = require("./payment");

// 1. Primary tournament sync: once per day at 2:00 AM
cron.schedule("0 2 * * *", async () => {
  console.log("[CRON] Starting primary tournament sync at", new Date());
  try {
    // Note: Assuming SportMonksController methods have been refactored
    await SportMonksController.syncAllTournamentData({}, { status: () => ({ json: () => { } }), json: () => { } });
  } catch (error) {
    console.error("[CRON] Error in tournament sync:", error);
  }
});

// 2. Player update: 2:05 AM
cron.schedule("5 2 * * *", async () => {
  try {
    await SportMonksController.updateAllPlayers({}, { status: () => ({ json: () => { } }), json: () => { } });
  } catch (error) {
    console.error("[CRON] Error in player updates:", error);
  }
});

// 3. Match notifications: every minute
cron.schedule("* * * * *", checkAndSendMatchNotifications);

// 4. Contest Completion & Payouts: every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    const contests = await Contest.find({ status: { $ne: 'completed' } }).populate('match');

    for (const contest of contests) {
      const match = contest.match;
      if (!match || match.status !== "Finished") continue;

      // Start session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        contest.status = 'completed';
        await contest.save({ session });

        // Leaderboard logic - using aggregate or find on FantasyGame
        const entries = await mongoose.model('FantasyGame').find({ contest: contest._id })
          .sort({ rank: 1 })
          .session(session);

        const winnings = contest.winnings || [];
        for (const tier of winnings) {
          const winners = entries.filter(e => e.rank >= tier.from && e.rank <= tier.to);
          for (const winner of winners) {
            if (tier.price > 0) {
              // Update user wallet
              await Wallet.findOneAndUpdate(
                { user: winner.user },
                { $inc: { balance: tier.price } },
                { session }
              );
              await User.findByIdAndUpdate(
                winner.user,
                { $inc: { wallet_balance: tier.price } },
                { session }
              );

              // Create transaction
              await Transaction.create([{
                user: winner.user,
                title: `${match.team1?.short_name || 'T1'} vs ${match.team2?.short_name || 'T2'}`,
                amount: tier.price,
                transactionType: "contest_winning",
                status: "completed",
                contest: contest._id
              }], { session });
            }
          }
        }

        await session.commitTransaction();
        console.log(`[CRON] Contest ${contest._id} completed`);
      } catch (err) {
        await session.abortTransaction();
        console.error(`[CRON] Payout failed for contest ${contest._id}:`, err);
      } finally {
        session.endSession();
      }
    }
  } catch (error) {
    console.error("[CRON] Error in contest completion:", error);
  }
});

// 5+6. Staggered updates
cron.schedule("*/3 * * * *", async () => {
  try {
    await SportMonksController.getFixtureDetails({}, { status: () => ({ json: () => { } }), json: () => { } });
  } catch (error) { }
});

cron.schedule("* * * * *", async () => {
  try {
    await updateLeaderboardForTodayMatches();
  } catch (error) { }
});

cron.schedule("*/5 * * * *", expireOldTransactions);
