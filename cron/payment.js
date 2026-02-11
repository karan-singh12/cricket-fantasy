const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

const expireOldTransactions = async () => {
  try {
    console.log("🔍 Checking for expired transactions...");

    const expirationTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const expiredTransactions = await Transaction.find({
      status: "INITIATED",
      transactionType: "credit",
      created_at: { $lt: expirationTime }
    });

    if (expiredTransactions.length > 0) {
      console.log(`📦 Found ${expiredTransactions.length} expired transactions`);

      for (const transaction of expiredTransactions) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          transaction.status = "FAILED";
          transaction.updated_at = new Date();
          await transaction.save({ session });

          // Assuming there's a PaymentApproval model if needed
          // await PaymentApproval.updateMany({ transaction: transaction._id }, ...);

          await session.commitTransaction();
          console.log(`❌ Expired transaction: ${transaction._id}`);
        } catch (error) {
          await session.abortTransaction();
          console.error("Error expiring transaction:", error);
        } finally {
          session.endSession();
        }
      }
    }
  } catch (error) {
    console.error("Error in expireOldTransactions cron:", error);
  }
};

module.exports = { expireOldTransactions };
