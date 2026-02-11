const { knex: db } = require("../config/database");
const expireOldTransactions = async () => {
  try {
    console.log("🔍 Checking for expired transactionssss...");

    // 2 hours
    const expirationTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const expiredTransactions = await db("transactions")
      .where("status", "INITIATED")
      .where("transactionType", "credit")
      .where("created_at", "<", expirationTime)
      .select("id", "payment_id", "merchant_invoice_number");

    if (expiredTransactions.length > 0) {
      console.log(
        `📦 Found ${expiredTransactions.length} expired transactions`
      );

      for (const transaction of expiredTransactions) {
        const trx = await db.transaction();
        try {
          await trx("transactions").where("id", transaction.id).update({
            status: "FAILED",
            updated_at: db.fn.now(),
          });

          await trx("payment_approvals")
            .where("transaction_id", transaction.id)
            .update({
              status: "REJECTED",
              admin_notes: "Payment expired - not completed within time limit",
              updated_at: db.fn.now(),
            });

          await trx.commit();
          console.log(
            `❌ Expired transaction: ${transaction.merchant_invoice_number}`
          );
        } catch (error) {
          await trx.rollback();
          console.error("Error expiring transaction:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error in expireOldTransactions cron:", error);
  }
};

module.exports = { expireOldTransactions };
