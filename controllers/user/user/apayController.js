const { USER, WALLET, APAY } = require("../../utils/responseMsg");
const APayService = require("../../services/apayService");
const APayHelper = require("../../utils/apayHelper");
const { v4: uuidv4 } = require("uuid");
const { knex: db } = require("../../config/database");
const config = require("../../config/config");
const apiResponse = require("../../utils/apiResponse");

class APayController {
  constructor() {
    this.apayService = new APayService();
  }
  async getDepositMode() {
    try {
      const row = await db("social_links")
        .select("mode")
        .orderBy("id", "desc")
        .first();
      return row && row.mode ? row.mode.toUpperCase() : "MANUAL";
    } catch (error) {
      console.error("Failed to get deposit mode from social_links:", error);
      return "MANUAL";
    }
  }

  determineFinalStatus = (result) => {
    if (!result.success) return "FAILED";

    const status = result.status?.toLowerCase();
    switch (status) {
      case "success":
      case "completed":
        return "SUCCESS";
      case "pending":
      case "processing":
      case "initiated":
        return "PROCESSING";
      case "failed":
      case "rejected":
      case "cancelled":
        return "FAILED";
      default:
        return "PROCESSING";
    }
  };
  getStatusMessage = (status) => {
    switch (status) {
      case "SUCCESS":
        return "Deposit completed successfully";
      case "PROCESSING":
        return "Deposit is being processed";
      case "FAILED":
        return "Deposit failed";
      default:
        return "Deposit initiated";
    }
  };
  getStatusDescription = (status) => {
    switch (status) {
      case "SUCCESS":
        return "Your deposit has been completed and funds have been added to your wallet.";
      case "PROCESSING":
        return "Your deposit is being processed. Please complete the payment if required.";
      case "FAILED":
        return "Your deposit could not be processed. Please try again.";
      default:
        return "Your deposit has been initiated. Please complete the payment process.";
    }
  };
  handlePaymentCallback = async (req, res) => {
    try {
      console.log("Payment callback - Full URL:", req.url);
      console.log("Payment callback - Query params:", req.query);

      const {
        custom_transaction_id,
        status: apay_status,
        order_id: callback_order_id,
      } = req.query;

      if (!custom_transaction_id) {
        console.error("No custom_transaction_id found in callback");
        return res.status(400).json({
          success: false,
          message: "Transaction ID not found in payment callback",
        });
      }

      // Find transaction by custom_transaction_id
      const transaction = await db("transactions")
        .where({ merchant_invoice_number: custom_transaction_id })
        .first();

      if (!transaction) {
        console.error(`Transaction not found: ${custom_transaction_id}`);
        return res.status(400).json({
          success: false,
          message: "Transaction not found",
        });
      }

      // Use order_id from callback if available, otherwise from transaction
      const order_id = callback_order_id || transaction.payment_id;

      // Normalize status for mapping - convert to lowercase and trim
      const normalizedStatus = String(apay_status || "")
        .trim()
        .toLowerCase();
      let finalStatus = transaction.status;

      // Do not change terminal states
      if (["FAILED", "SUCCESS"].includes(transaction.status)) {
        return res.json({
          success: true,
          order_id: order_id || custom_transaction_id,
          status: transaction.status,
          message: this.getStatusDescription(transaction.status),
          timestamp: new Date().toISOString(),
        });
      }

      // Debug log to see what we're receiving
      console.log(
        `Callback received - Status: ${apay_status}, Normalized: ${normalizedStatus}, Transaction ID: ${custom_transaction_id}`
      );

      // Handle different status scenarios
      if (normalizedStatus === "success" || normalizedStatus === "completed") {
        // Don't mark as SUCCESS yet, wait for webhook for proper verification
        finalStatus = "PROCESSING";

        if (callback_order_id && !transaction.payment_id) {
          await db("transactions")
            .where({ merchant_invoice_number: custom_transaction_id })
            .update({
              payment_id: callback_order_id,
              updated_at: db.fn.now(),
            });
        }
      } else if (
        normalizedStatus === "failed" ||
        normalizedStatus === "fail" ||
        normalizedStatus === "cancel" || // This should now match "Cancel" (converted to lowercase)
        normalizedStatus === "cancelled" ||
        normalizedStatus === "rejected" ||
        normalizedStatus === "expired" ||
        normalizedStatus === "timeout" ||
        // Handle cases where status parameter is missing (likely cancelled)
        apay_status === undefined ||
        apay_status === null ||
        apay_status === ""
      ) {
        // Mark as FAILED for all failure/cancellation scenarios
        finalStatus = "FAILED";

        console.log(
          `Marking transaction ${custom_transaction_id} as FAILED due to status: ${
            apay_status || "MISSING"
          }`
        );

        // Also update payment_approvals if needed
        const approval = await db("payment_approvals")
          .where({ transaction_id: transaction.id, type: "DEPOSIT" })
          .first();

        if (approval) {
          await db("payment_approvals")
            .where({ transaction_id: transaction.id, type: "DEPOSIT" })
            .update({
              status: "REJECTED",
              admin_notes: `Payment ${apay_status || "cancelled"} by user`,
              updated_at: db.fn.now(),
            });
        }
      } else if (
        normalizedStatus === "created" ||
        normalizedStatus === "initiated" ||
        normalizedStatus === "pending" ||
        normalizedStatus === "processing"
      ) {
        // Treat these as in-progress states
        finalStatus = "PROCESSING";
      } else {
        // For any unknown status, default to PROCESSING but log it
        finalStatus = "PROCESSING";
        console.log(
          `Unknown status received: ${apay_status}, defaulting to PROCESSING`
        );
      }

      // Update transaction status
      await db("transactions")
        .where({ merchant_invoice_number: custom_transaction_id })
        .update({
          status: finalStatus,
          updated_at: db.fn.now(),
        });

      console.log(
        `Payment callback processed: ${custom_transaction_id} - Status: ${finalStatus} - Original status: ${
          apay_status || "MISSING"
        }`
      );

      return res.json({
        success: true,
        order_id: order_id || custom_transaction_id,
        status: finalStatus,
        message:
          finalStatus === "PROCESSING"
            ? "Payment is being processed. You will be notified when completed."
            : finalStatus === "FAILED"
            ? "Payment was cancelled or failed. Please try again."
            : "Payment is being processed...",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Payment callback error:", error);
      return res.status(500).json({
        success: false,
        message: "Payment processing error",
        error: error.message,
      });
    }
  };

  handleDepositWebhook = async (req, res) => {
    try {
      console.log("🎯 WEBHOOK RECEIVED at:", new Date().toISOString());
      console.log("📊 Webhook Data:", req.body);

      const { access_key, signature, transactions } = req.body;

      if (
        !access_key ||
        !signature ||
        !transactions ||
        !Array.isArray(transactions)
      ) {
        console.error("Invalid webhook payload structure");
        return res.status(400).json({ status: "INVALID_PAYLOAD" });
      }

      let isValid;
      try {
        isValid = APayHelper.verifyWebhookSignature(
          access_key,
          config.apay.private_key,
          transactions,
          signature
        );
      } catch (signatureError) {
        console.error("Signature verification error:", signatureError);
        return res.status(400).json({ status: "SIGNATURE_ERROR" });
      }

      if (!isValid) {
        console.error("Invalid webhook signature");
        return res.status(400).json({ status: "INVALID_SIGNATURE" });
      }
      const depositMode = await this.getDepositMode();
      console.log(`📊 Current deposit mode: ${depositMode}`);

      for (const transaction of transactions) {
        const {
          order_id,
          status,
          amount,
          currency,
          custom_user_id,
          custom_transaction_id,
          payment_system, // This might come from webhook
          payment_system: webhook_payment_system, // Alternative field name
          account_number,
        } = transaction;

        if (!order_id || !status || !amount || !custom_user_id) {
          console.warn(`Missing required fields for transaction:`, transaction);
          continue;
        }

        const safeAmount = parseFloat(amount);
        if (isNaN(safeAmount)) {
          console.warn(`Invalid amount for order ${order_id}`);
          continue;
        }

        const trx = await db.transaction();
        try {
          const existing = await trx("transactions")
            .where(function () {
              this.where("payment_id", order_id).orWhere(
                "merchant_invoice_number",
                custom_transaction_id
              );
            })
            .forUpdate()
            .first();

          if (!existing) {
            console.error(`Transaction not found for order ${order_id}`);
            // create a minimal transaction row to track failure/success coming from webhook
            const userId = String(custom_user_id || "").replace("USER_", "");
            const normalized = String(status || "").toLowerCase();
            const initialStatus = ["failed", "rejected", "cancelled"].includes(
              normalized
            )
              ? "FAILED"
              : normalized === "success"
              ? depositMode === "AUTO"
                ? "SUCCESS"
                : "PROCESSING"
              : "PROCESSING";
            await trx("transactions").insert({
              user_id: userId,
              title: `Deposit - ${safeAmount}`,
              amount: safeAmount,
              currency: currency || "BDT",
              transactionType: "credit",
              status: initialStatus,
              payment_id: order_id,
              merchant_invoice_number: custom_transaction_id,
              mode: depositMode,
              bank: transaction.payment_system || "unknown",
              created_at: trx.fn.now(),
              updated_at: trx.fn.now(),
            });
            await trx.commit();
            continue;
          }

          if (existing.status === "SUCCESS") {
            console.log(`Already processed: ${order_id}`);
            await trx.commit();
            continue;
          }

          // Check if payment_approvals record exists, create if not
          let approval = await trx("payment_approvals")
            .where({ transaction_id: existing.id, type: "DEPOSIT" })
            .first();

          if (status.toLowerCase() === "success") {
            if (depositMode === "AUTO") {
              // AUTO mode: Process deposit automatically without admin approval
              console.log(
                `🚀 AUTO mode: Processing deposit automatically for order ${order_id}`
              );

              const userId = custom_user_id.replace("USER_", "");

              // Ensure wallet exists, create if not
              let wallet = await trx("wallet")
                .where({ user_id: userId })
                .first();
              if (!wallet) {
                await trx("wallet").insert({
                  user_id: userId,
                  balance: 0,
                  currency: currency || "BDT",
                  created_at: trx.fn.now(),
                  updated_at: trx.fn.now(),
                });
              }

              // Update user wallet balance
              await trx("users")
                .where({ id: userId })
                .increment("wallet_balance", safeAmount);

              // Update wallet table
              await trx("wallet")
                .where({ user_id: userId })
                .increment("balance", safeAmount)
                .update({ updated_at: trx.fn.now() });

              // Update transaction status to SUCCESS
              await trx("transactions")
                .where("id", existing.id)
                .update({
                  status: "SUCCESS",
                  payment_id: order_id,
                  mode: depositMode,
                  bank: transaction.payment_system || existing.payment_system,
                  updated_at: trx.fn.now(),
                });

              // Create notification
              const template = await trx("notification_templates")
                .where({ slug: "Deposit-Successful", status: 1 })
                .first();

              if (template) {
                const title = template.title || "Deposit Successful";
                const content = (template.content || "")
                  .replace("{{currency}}", currency || "BDT")
                  .replace("{{amount}}", safeAmount.toFixed(2));

                await trx("notifications").insert({
                  user_id: userId,
                  title: title,
                  content: content,
                  is_read: false,
                  sent_at: trx.fn.now(),
                  created_at: trx.fn.now(),
                });
              }

              // Send push notification
              const user = await trx("users").where({ id: userId }).first();
              if (user && user.ftoken) {
                try {
                  const {
                    sendPushNotificationFCM,
                  } = require("../../utils/functions");
                  await sendPushNotificationFCM(
                    user.ftoken,
                    "Deposit Successful",
                    `Your deposit of ${currency || "BDT"} ${safeAmount.toFixed(
                      2
                    )} has been completed successfully.`
                  );
                } catch (pushError) {
                  console.error("FCM push failed:", pushError);
                }
              }

              console.log(
                `✅ AUTO: Deposit completed automatically for order ${order_id}`
              );
            } else {
              // MANUAL mode: Require admin approval
              console.log(
                `⏳ MANUAL mode: Deposit awaiting admin approval for order ${order_id}`
              );

              // Check if payment_approvals record exists, create if not
              let approval = await trx("payment_approvals")
                .where({ transaction_id: existing.id, type: "DEPOSIT" })
                .first();

              if (!approval) {
                await trx("payment_approvals").insert({
                  transaction_id: existing.id,
                  type: "DEPOSIT",
                  status: "PENDING",
                  payment_system: transaction.payment_system || "unknown",
                  account_number: account_number || null,
                  created_at: trx.fn.now(),
                  updated_at: trx.fn.now(),
                });
              }

              await trx("transactions")
                .where("id", existing.id)
                .update({
                  status: "PROCESSING",
                  payment_id: order_id,
                  bank: transaction.payment_system || existing.payment_system,
                  mode: depositMode,
                  updated_at: trx.fn.now(),
                });
            }
          } else if (
            ["failed", "rejected", "cancelled"].includes(status.toLowerCase())
          ) {
            await trx("transactions")
              .where("id", existing.id)
              .update({
                status: "FAILED",
                mode: depositMode,
                payment_id: order_id,
                bank: transaction.payment_system || existing.payment_system,
                updated_at: trx.fn.now(),
              });

            // Only create approval record in MANUAL mode for failed transactions
            if (depositMode === "MANUAL") {
              let approval = await trx("payment_approvals")
                .where({ transaction_id: existing.id, type: "DEPOSIT" })
                .first();

              if (!approval) {
                await trx("payment_approvals").insert({
                  transaction_id: existing.id,
                  type: "DEPOSIT",
                  status: "REJECTED",
                  payment_system: transaction.payment_system || "unknown",
                  account_number: transaction.account_number || null,
                  admin_notes: "Payment failed or cancelled",
                  created_at: trx.fn.now(),
                  updated_at: trx.fn.now(),
                });
              } else {
                await trx("payment_approvals")
                  .where({ transaction_id: existing.id, type: "DEPOSIT" })
                  .update({
                    status: "REJECTED",
                    admin_notes: "Payment failed or cancelled",
                    updated_at: trx.fn.now(),
                  });
              }
            }

            console.log(`Deposit failed: ${order_id} - Status: ${status}`);
          } else {
            // avoid downgrading terminal states
            if (["FAILED", "SUCCESS"].includes(existing.status)) {
              await trx.commit();
              continue;
            }
            await trx("transactions").where("id", existing.id).update({
              status: "PROCESSING",
              mode: depositMode,
              updated_at: trx.fn.now(),
            });
            console.log(
              `Deposit still processing: ${order_id} - Status: ${status}`
            );
          }

          await trx.commit();
        } catch (error) {
          await trx.rollback();
          console.error(`Error processing webhook for order ${order_id}:`, {
            error: error.message,
            stack: error.stack,
            order_id,
            status,
            amount,
            userId: custom_user_id,
          });
        }
      }

      return res.json({ status: "OK" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).json({ status: "ERROR" });
    }
  };
 
  

  // for admin purpose to get all payment requests
  getAllpaymentRequests = async (req, res) => {
    const {
      status,
      type,
      page = 1,
      pageSize = 10,
      sortField = "created_at", // 👈 Changed to alias
      sortOrder = "desc",
      mode,
    } = req.body;
  
    try {
      if (!req.user) {
        return apiResponse.ErrorResponse(
          res,
          "Unauthorized: Admin access required"
        );
      }
  
      const currentMode = await this.getDepositMode();
  
      let dataQuery, countQuery, summaryQuery;
  
      const buildAutoQuery = (qb) => {
        return qb
          .join("users", "transactions.user_id", "users.id")
          .select(
            db.raw("NULL as approval_id"),
            "transactions.id as transaction_id",
            db.raw(`CASE 
              WHEN transactions."transactionType" = 'debit' THEN 'WITHDRAWAL'
              ELSE 'DEPOSIT'
            END as type`),
            "transactions.status as approval_status",
            db.raw("NULL as admin_notes"),
            db.raw("transactions.created_at as created_at"), // 👈 Alias standardized
            db.raw("NULL as payment_system"),
            db.raw("NULL as account_number"),
            "transactions.amount",
            "transactions.currency",
            "transactions.merchant_invoice_number",
            "transactions.status as transaction_status",
            "transactions.mode",
            "transactions.payment_id",
            "transactions.bank",
            "users.id as user_id",
            "users.name as user_name",
            db.raw("NULL as approval_account_number"),
            "transactions.account_number",
            "users.email as user_email",
            "users.phone as user_phone",
            db.raw(
              "CASE WHEN transactions.status IN ('PROCESSING','SUCCESS') THEN true ELSE false END as iswebhookreceived"
            )
          )
          .where("transactions.mode", "AUTO");
      };
  
      const buildManualQuery = (qb) => {
        return qb
          .join("transactions", "payment_approvals.transaction_id", "transactions.id")
          .join("users", "transactions.user_id", "users.id")
          .select(
            "payment_approvals.id as approval_id",
            "payment_approvals.transaction_id",
            "payment_approvals.type",
            "payment_approvals.status as approval_status",
            "payment_approvals.admin_notes",
            db.raw("payment_approvals.created_at as created_at"), // 👈 Alias standardized
            "payment_approvals.payment_system",
            "payment_approvals.account_number",
            "transactions.amount",
            "transactions.currency",
            "transactions.merchant_invoice_number",
            "transactions.status as transaction_status",
            "transactions.mode",
            "transactions.payment_id",
            "transactions.bank",
            "users.id as user_id",
            "users.name as user_name",
            "payment_approvals.account_number as approval_account_number",
            "transactions.account_number",
            "users.email as user_email",
            "users.phone as user_phone",
            db.raw(
              "CASE WHEN transactions.status IN ('PROCESSING','SUCCESS') THEN true ELSE false END as iswebhookreceived"
            )
          )
          .where("transactions.mode", "MANUAL");
      };
  
      if (mode === "AUTO") {
        dataQuery = buildAutoQuery(db("transactions"));
        countQuery = db("transactions").where("mode", "AUTO");
        summaryQuery = db("transactions")
          .where("mode", "AUTO")
          .select(
            db.raw("COUNT(*) as total"),
            db.raw("COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending"),
            db.raw("COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved"),
            db.raw("COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected")
          );
  
        if (status) {
          dataQuery = dataQuery.where("transactions.status", status);
          countQuery = countQuery.where("status", status);
          summaryQuery = summaryQuery.where("status", status);
        }
        if (type) {
          if (type === "WITHDRAWAL") {
            dataQuery = dataQuery.where("transactionType", "debit");
            countQuery = countQuery.where("transactionType", "debit");
            summaryQuery = summaryQuery.where("transactionType", "debit");
          } else if (type === "DEPOSIT") {
            dataQuery = dataQuery.where(function () {
              this.whereNot("transactionType", "debit").orWhereNull("transactionType");
            });
            countQuery = countQuery.where(function () {
              this.whereNot("transactionType", "debit").orWhereNull("transactionType");
            });
            summaryQuery = summaryQuery.where(function () {
              this.whereNot("transactionType", "debit").orWhereNull("transactionType");
            });
          }
        }
      } else if (mode === "MANUAL") {
        dataQuery = buildManualQuery(db("payment_approvals"));
        countQuery = db("payment_approvals")
          .join("transactions", "payment_approvals.transaction_id", "transactions.id")
          .where("transactions.mode", "MANUAL");
        summaryQuery = db("payment_approvals")
          .join("transactions", "payment_approvals.transaction_id", "transactions.id")
          .where("transactions.mode", "MANUAL")
          .select(
            db.raw("COUNT(*) as total"),
            db.raw("COUNT(CASE WHEN payment_approvals.status = 'PENDING' THEN 1 END) as pending"),
            db.raw("COUNT(CASE WHEN payment_approvals.status = 'APPROVED' THEN 1 END) as approved"),
            db.raw("COUNT(CASE WHEN payment_approvals.status = 'REJECTED' THEN 1 END) as rejected")
          );
  
        if (status) {
          dataQuery = dataQuery.where("payment_approvals.status", status);
          countQuery = countQuery.where("payment_approvals.status", status);
          summaryQuery = summaryQuery.where("payment_approvals.status", status);
        }
        if (type) {
          dataQuery = dataQuery.where("payment_approvals.type", type);
          countQuery = countQuery.where("payment_approvals.type", type);
          summaryQuery = summaryQuery.where("payment_approvals.type", type);
        }
      } else {
        // BOTH MODES
  
        let autoQuery = buildAutoQuery(db("transactions"));
        let manualQuery = buildManualQuery(db("payment_approvals"));
  
        if (status) {
          autoQuery = autoQuery.where("transactions.status", status);
          manualQuery = manualQuery.where("payment_approvals.status", status);
        }
        if (type) {
          if (type === "WITHDRAWAL") {
            autoQuery = autoQuery.where("transactionType", "debit");
          } else if (type === "DEPOSIT") {
            autoQuery = autoQuery.where(function () {
              this.whereNot("transactionType", "debit").orWhereNull("transactionType");
            });
          }
          manualQuery = manualQuery.where("payment_approvals.type", type);
        }
  
        dataQuery = autoQuery.union(manualQuery);
  
        // Count separately
        const autoCount = await db("transactions")
          .where("mode", "AUTO")
          .modify((qb) => {
            if (status) qb.where("status", status);
            if (type === "WITHDRAWAL") qb.where("transactionType", "debit");
            else if (type === "DEPOSIT")
              qb.where(function () {
                this.whereNot("transactionType", "debit").orWhereNull("transactionType");
              });
          })
          .count("* as count")
          .first();
  
        const manualCount = await db("payment_approvals")
          .join("transactions", "payment_approvals.transaction_id", "transactions.id")
          .where("transactions.mode", "MANUAL")
          .modify((qb) => {
            if (status) qb.where("payment_approvals.status", status);
            if (type) qb.where("payment_approvals.type", type);
          })
          .count("* as count")
          .first();
  
        const count = (parseInt(autoCount?.count || 0)) + (parseInt(manualCount?.count || 0));
  
        // Summary for both
        const autoSummary = await db("transactions")
          .where("mode", "AUTO")
          .modify((qb) => {
            if (status) qb.where("status", status);
            if (type === "WITHDRAWAL") qb.where("transactionType", "debit");
            else if (type === "DEPOSIT")
              qb.where(function () {
                this.whereNot("transactionType", "debit").orWhereNull("transactionType");
              });
          })
          .select(
            db.raw("COUNT(*) as total"),
            db.raw("COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending"),
            db.raw("COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved"),
            db.raw("COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected")
          )
          .first();
  
        const manualSummary = await db("payment_approvals")
          .join("transactions", "payment_approvals.transaction_id", "transactions.id")
          .where("transactions.mode", "MANUAL")
          .modify((qb) => {
            if (status) qb.where("payment_approvals.status", status);
            if (type) qb.where("payment_approvals.type", type);
          })
          .select(
            db.raw("COUNT(*) as total"),
            db.raw("COUNT(CASE WHEN payment_approvals.status = 'PENDING' THEN 1 END) as pending"),
            db.raw("COUNT(CASE WHEN payment_approvals.status = 'APPROVED' THEN 1 END) as approved"),
            db.raw("COUNT(CASE WHEN payment_approvals.status = 'REJECTED' THEN 1 END) as rejected")
          )
          .first();
  
        const summary = {
          total: (parseInt(autoSummary?.total || 0)) + (parseInt(manualSummary?.total || 0)),
          pending: (parseInt(autoSummary?.pending || 0)) + (parseInt(manualSummary?.pending || 0)),
          approved: (parseInt(autoSummary?.approved || 0)) + (parseInt(manualSummary?.approved || 0)),
          rejected: (parseInt(autoSummary?.rejected || 0)) + (parseInt(manualSummary?.rejected || 0)),
        };
  
        // Apply sort and paginate
        dataQuery = dataQuery.orderBy(sortField, sortOrder);
        const offset = (page - 1) * pageSize;
        const paymentRequests = await dataQuery.offset(offset).limit(pageSize);
  
        const responseData = {
          paymentRequests,
          currentMode,
          summary, // ✅ Summary object added
          pagination: {
            totalRecords: count,
            currentPage: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            totalPages: Math.ceil(count / pageSize),
          },
        };
  
        return apiResponse.successResponseWithData(
          res,
          "All Payment Requests retrieved",
          responseData
        );
      }
  
      // For single mode (AUTO or MANUAL)
      const countResult = await countQuery.count("* as count").first();
      const count = parseInt(countResult?.count || 0, 10);
  
      const summaryResult = await summaryQuery.first();
      const summary = {
        total: parseInt(summaryResult?.total || 0),
        pending: parseInt(summaryResult?.pending || 0),
        approved: parseInt(summaryResult?.approved || 0),
        rejected: parseInt(summaryResult?.rejected || 0),
      };
  
      const offset = (page - 1) * pageSize;
      const paymentRequests = await dataQuery
        .orderBy(sortField, sortOrder)
        .offset(offset)
        .limit(pageSize);
  
      const responseData = {
        paymentRequests,
        currentMode,
        summary, // ✅ Summary object added
        pagination: {
          totalRecords: count,
          currentPage: parseInt(page, 10),
          pageSize: parseInt(pageSize, 10),
          totalPages: Math.ceil(count / pageSize),
        },
      };
  
      return apiResponse.successResponseWithData(
        res,
        "All Payment Requests retrieved",
        responseData
      );
    } catch (error) {
      console.error("Get Payment Requests Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };

  // for admin purpose to process withdraw
  processPaymentRequest = async (req, res) => {
    try {
      const { approval_id, action, admin_notes } = req.body;
      
      if (!req.user) {
        return apiResponse.ErrorResponse(
          res,
          "Unauthorized: Admin access required"
        );
      }

      if (!approval_id || !["APPROVED", "REJECTED"].includes(action)) {
        return apiResponse.ErrorResponse(res, "Invalid approval ID or action");
      }

      const approval = await db("payment_approvals")
        .where({ id: approval_id, status: "PENDING" })
        .first();

 
      if (!approval) {
        return apiResponse.ErrorResponse(
          res,
          "Approval request not found or already processed"
        );
      }

      const transaction = await db("transactions")
        .where({ id: approval.transaction_id })
        .first();

      if (!transaction) {
        return apiResponse.ErrorResponse(res, "Transaction not found");
      }
   

      const adminUser = await db("admins").where({ id: req.user.id }).first();
      if (!adminUser) {
        return apiResponse.ErrorResponse(res, "Invalid admin user ID");
      }

      const trx = await db.transaction();
      try {
        if (approval.type === "DEPOSIT") {
          if (action === "APPROVED") {
            await trx("payment_approvals")
              .where({ id: approval_id })
              .update({
                status: "APPROVED",
                admin_notes: admin_notes || "APPROVED BY ADMIN",
                processed_by: req.user.id,
                processed_at: trx.fn.now(),
                updated_at: trx.fn.now(),
              });

            if (transaction.status === "PROCESSING") {
              const userId = transaction.user_id;
              const safeAmount = parseFloat(transaction.amount);

              let wallet = await trx("wallet")
                .where({ user_id: userId })
                .first();
              if (!wallet) {
                await trx("wallet").insert({
                  user_id: userId,
                  balance: 0,
                  currency: transaction.currency || "BDT",
                  created_at: trx.fn.now(),
                  updated_at: trx.fn.now(),
                });
              }

              await trx("users")
                .where({ id: userId })
                .increment("wallet_balance", safeAmount);

              await trx("wallet")
                .where({ user_id: userId })
                .increment("balance", safeAmount)
                .update({ updated_at: trx.fn.now() });

              await trx("transactions").where({ id: transaction.id }).update({
                status: "SUCCESS",
                updated_at: trx.fn.now(),
              });

              const templateApproved = await trx("notification_templates")
                .where({ slug: "Deposit-Approved-Completed", status: 1 })
                .first();

              if (templateApproved) {
                const title =
                  templateApproved.title || "Deposit Approved & Completed";
                const content = (templateApproved.content || "")
                  .replace("{{currency}}", transaction.currency || "BDT")
                  .replace("{{amount}}", safeAmount.toFixed(2));

                await trx("notifications").insert({
                  user_id: userId,
                  title: title,
                  content: content,
                  is_read: false,
                  sent_at: trx.fn.now(),
                  created_at: trx.fn.now(),
                });
              }

              const user = await trx("users").where({ id: userId }).first();
              if (user && user.ftoken) {
                try {
                  const {
                    sendPushNotificationFCM,
                  } = require("../../utils/functions");
                  await sendPushNotificationFCM(
                    user.ftoken,
                    "Deposit Approved & Completed",
                    `Your deposit of ${
                      transaction.currency || "BDT"
                    } ${safeAmount.toFixed(
                      2
                    )} has been approved and completed successfully.`
                  );
                } catch (pushError) {
                  console.error("FCM push failed:", pushError);
                }
              }

              console.log(
                `✅ MANUAL: Deposit approved and completed for order ${transaction.payment_id}`
              );
            }
          } else if (action === "REJECTED") {
            await trx("payment_approvals")
              .where({ id: approval_id })
              .update({
                status: "REJECTED",
                admin_notes: admin_notes || "REJECTED BY ADMIN",
                processed_by: req.user.id,
                processed_at: trx.fn.now(),
                updated_at: trx.fn.now(),
              });

            await trx("transactions").where({ id: transaction.id }).update({
              status: "FAILED",
              updated_at: trx.fn.now(),
            });

            const templateRejected = await trx("notification_templates")
              .where({ slug: "Deposit-Rejected", status: 1 })
              .first();

            if (templateRejected) {
              const title = templateRejected.title || "Deposit Rejected";
              const content = (templateRejected.content || "").replace(
                "{{admin_notes}}",
                admin_notes || "Please contact support for more information."
              );

              await trx("notifications").insert({
                user_id: transaction.user_id,
                title: title,
                content: content,
                is_read: false,
                sent_at: trx.fn.now(),
                created_at: trx.fn.now(),
              });
            }

            console.log(
              `❌ MANUAL: Deposit rejected for transaction ${transaction.id}`
            );
          }
        } else if (approval.type === "WITHDRAWAL") {
          if (action === "APPROVED") {
            const wallet = await db("wallet")
              .where({ user_id: transaction.user_id })
              .first();
            if (!wallet) {
              await trx.rollback();
              return apiResponse.ErrorResponse(res, WALLET.walletNotFound);
            }
            const balance = parseFloat(wallet.balance);
            const minBalance = 100;
            const availableToWithdraw = balance - minBalance;

            if (transaction.amount > availableToWithdraw) {
              await trx.rollback();
              return apiResponse.ErrorResponse(
                res,
                WALLET.withdrawalLimitExceeded
              );
            }

            const result = await this.apayService.createWithdrawal({
              amount: parseFloat(transaction.amount),
              currency: transaction.currency,
              paymentSystem: approval.payment_system,
              customUserId: `USER_${transaction.user_id}`,
              phoneNumber: approval.account_number,
              customTransactionId: transaction.merchant_invoice_number,
              email: transaction.email,
            });

            if (!result.success) {
              await trx("payment_approvals")
                .where({ id: approval_id })
                .update({
                  status: "REJECTED",
                  admin_notes: admin_notes || "Failed to process withdrawal",
                  processed_by: req.user.id,
                  processed_at: trx.fn.now(),
                  updated_at: trx.fn.now(),
                });
              await trx("transactions").where({ id: transaction.id }).update({
                status: "FAILED",
                updated_at: trx.fn.now(),
              });
              await trx.commit();
              return apiResponse.ErrorResponseWithData(
                res,
                APAY.withdrawalFailed,
                result
              );
            }

            await trx("transactions").where({ id: transaction.id }).update({
              payment_id: result.order_id,
              status: "PROCESSING",
              bank: approval.payment_system,
              updated_at: trx.fn.now(),
            });

            await trx("payment_approvals")
              .where({ id: approval_id })
              .update({
                status: "APPROVED",
                admin_notes: admin_notes || "APPROVED BY ADMIN",
                processed_by: req.user.id,
                processed_at: trx.fn.now(),
                updated_at: trx.fn.now(),
              });

            await trx("users")
              .where({ id: transaction.user_id })
              .decrement("wallet_balance", parseFloat(transaction.amount));

            await trx("wallet")
              .where({ user_id: transaction.user_id })
              .decrement("balance", parseFloat(transaction.amount))
              .update({ updated_at: trx.fn.now() });

            const templateWithdrawalApproved = await trx(
              "notification_templates"
            )
              .where({ slug: "Withdrawal-Approved", status: 1 })
              .first();

            if (templateWithdrawalApproved) {
              const title =
                templateWithdrawalApproved.title || "Withdrawal Approved";
              const content = (templateWithdrawalApproved.content || "")
                .replace("{{currency}}", transaction.currency || "BDT")
                .replace(
                  "{{amount}}",
                  parseFloat(transaction.amount).toFixed(2)
                );

              await trx("notifications").insert({
                user_id: transaction.user_id,
                title: title,
                content: content,
                is_read: false,
                sent_at: trx.fn.now(),
                created_at: trx.fn.now(),
              });
            }

            const user = await trx("users")
              .where({ id: transaction.user_id })
              .first();
            if (user && user.ftoken) {
              try {
                const {
                  sendPushNotificationFCM,
                } = require("../../utils/functions");
                await sendPushNotificationFCM(
                  user.ftoken,
                  "Withdrawal Approved",
                  `Your withdrawal request of ${
                    transaction.currency || "BDT"
                  } ${parseFloat(transaction.amount).toFixed(
                    2
                  )} has been approved and is being processed.`
                );
              } catch (pushError) {
                console.error("FCM push failed:", pushError);
              }
            }
          } else if (action === "REJECTED") {
            await trx("payment_approvals")
              .where({ id: approval_id })
              .update({
                status: "REJECTED",
                admin_notes: admin_notes || "REJECTED BY ADMIN",
                processed_by: req.user.id,
                processed_at: trx.fn.now(),
                updated_at: trx.fn.now(),
              });
            await trx("transactions").where({ id: transaction.id }).update({
              status: "FAILED",
              updated_at: trx.fn.now(),
            });

            const templateWithdrawalRejected = await trx(
              "notification_templates"
            )
              .where({ slug: "Withdrawal-Rejected", status: 1 })
              .first();

            if (templateWithdrawalRejected) {
              const title =
                templateWithdrawalRejected.title || "Withdrawal Rejected";
              const content = (
                templateWithdrawalRejected.content || ""
              ).replace(
                "{{admin_notes}}",
                admin_notes || "Please contact support for more information."
              );

              await trx("notifications").insert({
                user_id: transaction.user_id,
                title: title,
                content: content,
                is_read: false,
                sent_at: trx.fn.now(),
                created_at: trx.fn.now(),
              });
            }
          }
        }

        await trx.commit();
        return apiResponse.successResponse(
          res,
          `${approval.type} request ${action.toLowerCase()} successfully`
        );
      } catch (error) {
        await trx.rollback();
        console.error("Process Payment Request Error:", error);
        return apiResponse.ErrorResponse(res, error.message);
      }
    } catch (error) {
      console.error("Process Payment Request Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };

  createWithdrawal = async (req, res) => {
    try {
      const { amount, phone_number, payment_system, account_email } = req.body;
      

      if (!amount || !phone_number) {
        return apiResponse.ErrorResponse(
          res,
          APAY.amountAndPhoneNumberRequired
        );
      }

      if (amount < 400) {
        return apiResponse.ErrorResponse(res, "Minimum withdrawal 400");
      }
      const validPaymentSystems = ["bkash_b", "nagad_b", "upay"];
      if (!validPaymentSystems.includes(payment_system)) {
        return apiResponse.ErrorResponse(
          res,
          `Invalid payment system. Supported: ${validPaymentSystems.join(", ")}`
        );
      }
      if (account_email) {
        if (account_email.length > 100) {
          return apiResponse.ErrorResponse(
            res,
            "Account email must be 100 characters or less"
          );
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account_email)) {
          return apiResponse.ErrorResponse(res, "Invalid email format");
        }
      }

      const user = await db("users").where({ id: req.user.id }).first();
      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      const wallet = await db("wallet").where("user_id", req.user.id).first();
      if (!wallet) {
        return apiResponse.ErrorResponse(res, WALLET.walletNotFound);
      }

      const balance = parseFloat(wallet.balance);
      const minBalance = 100;
      const availableToWithdraw = balance - minBalance;

      if (amount > availableToWithdraw) {
        return apiResponse.ErrorResponse(res, WALLET.withdrawalLimitExceeded);
      }

      // Get current mode

      const customTransactionId = `WTH_${uuidv4().substring(0, 8)}`;
      const customUserId = `USER_${req.user.id}`;

      const trx = await db.transaction();
      let depositMode = await this.getDepositMode();
    
      try {
        const [transactionId] = await trx("transactions")
          .insert({
            user_id: req.user.id,
            email: account_email,
            title: `Withdraw - ${amount}`,
            amount: parseFloat(amount),
            account_number: phone_number,
            currency: "BDT",
            transactionType: "debit",
            status: depositMode === "AUTO" ? "INITIATED" : "PENDING",
            merchant_invoice_number: customTransactionId,
            mode: depositMode,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          })
          .returning("id");

        if (depositMode === "AUTO") {
       

          const result = await this.apayService.createWithdrawal({
            amount: parseFloat(amount),
            currency: "BDT",
            paymentSystem: payment_system,
            customUserId,
            phoneNumber: phone_number,
            customTransactionId,
            email: account_email,
          });

     
          if (!result.success) {
            await trx("transactions").where({ id: transactionId.id }).update({
              status: "FAILED",
              updated_at: trx.fn.now(),
            });
            await trx.commit();
            if (
              result.message &&
              result.message.includes(
                "no payment system found with such params or payment system is disabled"
              )
            ) {
              return apiResponse.ErrorResponse(
                res,
                "Payment system is disabled"
              );
            }
            return apiResponse.ErrorResponseWithData(
              res,
              APAY.withdrawalFailed,
              result
            );
          }

          await trx("transactions")
            .where({ id: transactionId.id })
            .update({
              payment_id: result.order_id,
              status:
                result.status === "Pending"
                  ? "INITIATED"
                  : result.status.toUpperCase(),
              updated_at: trx.fn.now(),
            });
          const withdrawalInfo = await this.apayService.getWithdrawalInfo(
            result.order_id
          );
          const bankName =
            withdrawalInfo.data?.payment_system || payment_system;

          if (bankName) {
            await trx("transactions")
              .where({ id: transactionId.id })
              .update({ bank: bankName, updated_at: trx.fn.now() });
          }

          if (result.status.toLowerCase() === "success") {
            await trx("users")
              .where({ id: req.user.id })
              .decrement("wallet_balance", parseFloat(amount));

            await trx("wallet")
              .where({ user_id: req.user.id })
              .decrement("balance", parseFloat(amount))
              .update({ updated_at: trx.fn.now() });

            const templateWithdrawalSuccessful = await trx(
              "notification_templates"
            )
              .where({ slug: "Withdrawal-Successful", status: 1 })
              .first();

            if (templateWithdrawalSuccessful) {
              const title =
                templateWithdrawalSuccessful.title || "Withdrawal Successful";
              const content = (templateWithdrawalSuccessful.content || "")
                .replace("{{currency}}", currency || "BDT")
                .replace(
                  "{{amount}}",
                  (safeAmount || parseFloat(amount)).toFixed(2)
                );

              await trx("notifications").insert({
                user_id: req.user?.id || existing.user_id,
                title: title,
                content: content,
                is_read: false,
                sent_at: trx.fn.now(),
                created_at: trx.fn.now(),
              });
            }
            if (user.ftoken) {
              try {
                const {
                  sendPushNotificationFCM,
                } = require("../../utils/functions");
                await sendPushNotificationFCM(
                  user.ftoken,
                  "Withdrawal Successful",
                  `Your withdrawal of BDT ${parseFloat(amount).toFixed(
                    2
                  )} was completed successfully.`
                );
              } catch (pushError) {
                console.error("FCM push failed:", pushError);
              }
            }
          }

          await trx.commit();
          return apiResponse.successResponseWithData(
            res,
            "Withdrawal initiated successfully in AUTO mode",
            {
              transactionId: transactionId.id,
              customTransactionId,
              orderId: result.order_id,
              status:
                result.status === "Pending"
                  ? "INITIATED"
                  : result.status.toUpperCase(),
              mode: depositMode,
              requiresApproval: false,
            }
          );
        } else {
          await trx("payment_approvals").insert({
            transaction_id: transactionId.id,
            type: "WITHDRAWAL",
            status: "PENDING",
            payment_system,
            account_number: String(phone_number),
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          });

          await trx.commit();
          return apiResponse.successResponseWithData(
            res,
            "Withdrawal request initiated, pending admin approval",
            {
              transactionId: transactionId.id,
              customTransactionId,
              status: "PENDING",
              mode: depositMode,
              requiresApproval: true,
            }
          );
        }
      } catch (error) {
        await trx.rollback();
        console.error("Create Withdrawal Transaction Error:", error);
        return apiResponse.ErrorResponse(res, error.message);
      }
    } catch (error) {
      console.error("Create Withdrawal Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };
  handleWithdrawalWebhook = async (req, res) => {
    try {
      const { access_key, signature, transactions } = req.body;
      console.log(
        "🎯 WITHDRAWAL WEBHOOK RECEIVED at:",
        new Date().toISOString()
      );
      console.log("📊 Withdrawal Webhook Data:", req.body);

      if (
        !access_key ||
        !signature ||
        !transactions ||
        !Array.isArray(transactions)
      ) {
        console.error("Invalid webhook payload structure");
        return res.status(400).json({ status: "INVALID_PAYLOAD" });
      }

      const isValid = APayHelper.verifyWebhookSignature(
        access_key,
        config.apay.private_key,
        transactions,
        signature
      );

      if (!isValid) {
        console.error("Invalid webhook signature");
        return res.status(400).json({ status: "INVALID_SIGNATURE" });
      }

      for (const transaction of transactions) {
        const {
          order_id,
          status,
          amount,
          currency,
          custom_user_id,
          custom_transaction_id,
          payment_system,
          account_number,
        } = transaction;

        if (!order_id || !status || !amount || !custom_user_id) {
          console.warn(`Missing required fields for transaction:`, transaction);
          continue;
        }

        const safeAmount = parseFloat(amount);
        if (isNaN(safeAmount)) {
          console.warn(`Invalid amount for order ${order_id}`);
          continue;
        }

        const trx = await db.transaction();
        try {
          const existing = await trx("transactions")
            .where(function () {
              this.where("payment_id", order_id).orWhere(
                "merchant_invoice_number",
                custom_transaction_id
              );
            })
            .forUpdate()
            .first();

          if (!existing) {
            console.error(`Transaction not found for order ${order_id}`);
            await trx.rollback();
            continue;
          }

          const depositMode = existing.mode || "MANUAL";
          console.log(
            `📊 Processing withdrawal for order ${order_id} in ${depositMode} mode`
          );

          // Always update bank if available
          const bankName = payment_system || existing.bank || "unknown";
          await trx("transactions").where({ id: existing.id }).update({
            bank: bankName,
            updated_at: trx.fn.now(),
          });

          // Handle MANUAL withdrawals
          if (depositMode === "MANUAL") {
            const approval = await trx("payment_approvals")
              .where({ transaction_id: existing.id, type: "WITHDRAWAL" })
              .first();

            if (
              existing.status !== "PROCESSING" ||
              !approval ||
              approval.status !== "APPROVED"
            ) {
              console.warn(`Withdrawal not approved for order ${order_id}`);
              await trx("transactions").where({ id: existing.id }).update({
                status: "FAILED",
                updated_at: trx.fn.now(),
              });

              if (approval) {
                await trx("payment_approvals")
                  .where({ transaction_id: existing.id, type: "WITHDRAWAL" })
                  .update({
                    status: "REJECTED",
                    admin_notes: "Payment not approved",
                    updated_at: trx.fn.now(),
                  });
              }

              await trx.commit();
              continue;
            }
          }

          // Process SUCCESS withdrawals
          if (status.toLowerCase() === "success") {
            if (
              existing.status === "SUCCESS" &&
              parseFloat(existing.amount) === safeAmount
            ) {
              console.log(`Already processed with same amount: ${order_id}`);
              await trx.commit();
              continue;
            }

            await trx("transactions").where({ id: existing.id }).update({
              status: "SUCCESS",
              updated_at: trx.fn.now(),
            });

            // Only deduct balance if not already done (for AUTO mode)
            if (depositMode === "AUTO" || existing.status !== "PROCESSING") {
              const userId = custom_user_id.replace("USER_", "");
              await trx("users")
                .where({ id: userId })
                .decrement("wallet_balance", safeAmount);
              await trx("wallet")
                .where({ user_id: userId })
                .decrement("balance", safeAmount)
                .update({ updated_at: trx.fn.now() });
            }

            const templateWithdrawalSuccessful = await trx(
              "notification_templates"
            )
              .where({ slug: "Withdrawal-Successful", status: 1 })
              .first();

            if (templateWithdrawalSuccessful) {
              const title =
                templateWithdrawalSuccessful.title || "Withdrawal Successful";
              const content = (templateWithdrawalSuccessful.content || "")
                .replace("{{currency}}", currency || "BDT")
                .replace(
                  "{{amount}}",
                  (safeAmount || parseFloat(amount)).toFixed(2)
                );

              await trx("notifications").insert({
                user_id: req.user?.id || existing.user_id,
                title: title,
                content: content,
                is_read: false,
                sent_at: trx.fn.now(),
                created_at: trx.fn.now(),
              });
            }

            const user = await trx("users")
              .where({ id: existing.user_id })
              .first();
            if (user && user.ftoken) {
              try {
                const {
                  sendPushNotificationFCM,
                } = require("../../utils/functions");
                await sendPushNotificationFCM(
                  user.ftoken,
                  "Withdrawal Successful",
                  `Your withdrawal of ${currency || "BDT"} ${safeAmount.toFixed(
                    2
                  )} was completed successfully.`
                );
              } catch (pushError) {
                console.error("FCM push failed:", pushError);
              }
            }

            console.log(
              `✅ Withdrawal processed successfully for order ${order_id}`
            );
          } else if (["failed", "rejected"].includes(status.toLowerCase())) {
            await trx("transactions").where({ id: existing.id }).update({
              status: "FAILED",
              updated_at: trx.fn.now(),
            });

            if (depositMode === "MANUAL") {
              await trx("payment_approvals")
                .where({ transaction_id: existing.id, type: "WITHDRAWAL" })
                .update({
                  status: "REJECTED",
                  admin_notes: "Payment failed or rejected",
                  updated_at: trx.fn.now(),
                });
            }

            console.log(`❌ Withdrawal failed for order ${order_id}`);
          }

          await trx.commit();
        } catch (error) {
          await trx.rollback();
          console.error(`Error processing withdrawal for order ${order_id}:`, {
            error: error.message,
            stack: error.stack,
            order_id,
            status,
            amount,
            userId: custom_user_id,
          });
        }
      }

      return res.json({ status: "OK" });
    } catch (error) {
      console.error("Withdrawal webhook processing error:", error);
      return res.status(500).json({ status: "ERROR" });
    }
  };

  getPaymentSystems = async (req, res) => {
    try {
      const result = await this.apayService.getPaymentSystems();
      return apiResponse.successResponseWithData(
        res,
        APAY.paymentSystemsRetrieved,
        result
      );
    } catch (error) {
      console.error("Get Payment Systems Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };
  getDepositStatus = async (req, res) => {
    try {
      const { order_id } = req.params;

      if (!order_id) {
        return apiResponse.ErrorResponse(res, "Order ID is required");
      }

      const transaction = await db("transactions")
        .where({ payment_id: order_id, user_id: req.user.id })
        .first();

      if (!transaction) {
        return apiResponse.ErrorResponse(res, "Transaction not found");
      }

      if (transaction.status === "SUCCESS") {
        return apiResponse.successResponseWithData(
          res,
          "Deposit completed successfully",
          {
            orderId: order_id,
            status: "SUCCESS",
            isComplete: true,
            message: "Your deposit has been completed successfully.",
          }
        );
      }

      try {
        const result = await this.apayService.getDepositInfo(order_id);

        if (result.success) {
          const finalStatus = this.determineFinalStatus(result);

          await db("transactions").where({ payment_id: order_id }).update({
            status: finalStatus,
            updated_at: db.fn.now(),
          });

          return apiResponse.successResponseWithData(
            res,
            this.getStatusMessage(finalStatus),
            {
              orderId: order_id,
              status: finalStatus,
              isComplete: ["SUCCESS", "COMPLETED"].includes(finalStatus),
              requiresAction: ["PENDING", "PROCESSING", "INITIATED"].includes(
                finalStatus
              ),
              message: this.getStatusDescription(finalStatus),
            }
          );
        }
      } catch (error) {
        console.error("Error checking APay status:", error);
      }

      return apiResponse.successResponseWithData(
        res,
        this.getStatusMessage(transaction.status),
        {
          orderId: order_id,
          status: transaction.status,
          isComplete: transaction.status === "SUCCESS",
          requiresAction: ["PENDING", "PROCESSING", "INITIATED"].includes(
            transaction.status
          ),
          message: this.getStatusDescription(transaction.status),
        }
      );
    } catch (error) {
      console.error("Get Deposit Status Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };

  activateDeposit = async (req, res) => {
    try {
      const { order_id, payment_system, data } = req.body;
   
      if (!order_id || !payment_system) {
        return apiResponse.ErrorResponse(
          res,
          APAY.orderIdAndPaymentSystemRequired
        );
      }
      const result = await this.apayService.activateDeposit(
        order_id,
        payment_system,
        data || {}
      );
      if (result.success) {
        return apiResponse.successResponseWithData(
          res,
          APAY.depositActivatedSuccessfully,
          result
        );
      } else {
        return apiResponse.ErrorResponseWithData(
          res,
          APAY.depositActivationFailed,
          result
        );
      }
    } catch (error) {
      console.error("Activate Deposit Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };

  getTransactionStatus = async (req, res) => {
    try {
      const { order_id, type = "deposit" } = req.params;
    

      let result;
      if (type === "deposit") {
        result = await this.apayService.getDepositInfo(order_id);
      } else if (type === "withdrawal") {
        result = await this.apayService.getWithdrawalInfo(order_id);
      } else {
        return apiResponse.ErrorResponse(res, APAY.invalidTransactionType);
      }

      if (result.success) {
        await db("transactions").where({ payment_id: order_id }).update({
          status: result.status.toUpperCase(),
          updated_at: db.fn.now(),
        });

        return apiResponse.successResponseWithData(
          res,
          "Transaction status retrieved",
          result
        );
      } else {
        return apiResponse.ErrorResponseWithData(
          res,
          APAY.failedToGetTransactionStatus,
          result
        );
      }
    } catch (error) {
      console.error("Get Transaction Status Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };

  getTransactionMetrics = async (req, res) => {
    try {
      if (!req.user) {
        apiResponse.ErrorResponse(res, "Unauthorized: Admin access required");
        return;
      }

      const adminUser = await db("admins").where({ id: req.user.id }).first();
      if (!adminUser) {
        return apiResponse.ErrorResponse(res, "Invalid admin user ID");
      }

      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfThreeMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 2,
        1
      );
      const startOfSixMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 5,
        1
      );

      const todayDepositResult = await db("transactions")
        .where({
          transactionType: "credit",
          status: "SUCCESS",
        })
        .andWhere("created_at", ">=", startOfToday)
        .sum("amount as total")
        .first();

      const thisMonthDepositResult = await db("transactions")
        .where({
          transactionType: "credit",
          status: "SUCCESS",
        })
        .andWhere("created_at", ">=", startOfMonth)
        .sum("amount as total")
        .first();

      const currentMonthWithdrawalResult = await db("transactions")
        .where({
          transactionType: "debit",
          status: "SUCCESS",
        })
        .andWhere("created_at", ">=", startOfMonth)
        .sum("amount as total")
        .first();

      const lastThreeMonthsWithdrawalResult = await db("transactions")
        .where({
          transactionType: "debit",
          status: "SUCCESS",
        })
        .andWhere("created_at", ">=", startOfThreeMonthsAgo)
        .sum("amount as total")
        .first();

      const lastSixMonthsWithdrawalResult = await db("transactions")
        .where({
          transactionType: "debit",
          status: "SUCCESS",
        })
        .andWhere("created_at", ">=", startOfSixMonthsAgo)
        .sum("amount as total")
        .first();

      const responseData = {
        todayTotalDeposit: parseFloat(todayDepositResult.total || 0).toFixed(2),
        thisMonthTotalDeposit: parseFloat(
          thisMonthDepositResult.total || 0
        ).toFixed(2),
        currentMonthTotalWithdrawal: parseFloat(
          currentMonthWithdrawalResult.total || 0
        ).toFixed(2),
        lastThreeMonthsTotalWithdrawal: parseFloat(
          lastThreeMonthsWithdrawalResult.total || 0
        ).toFixed(2),
        lastSixMonthsTotalWithdrawal: parseFloat(
          lastSixMonthsWithdrawalResult.total || 0
        ).toFixed(2),
      };

      return apiResponse.successResponseWithData(
        res,
        "Transaction metrics retrieved successfully",
        responseData
      );
    } catch (error) {
      console.error("Get Transaction Metrics Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };

  createPaymentPage = async (req, res) => {
    try {
      const {
        amount,
        currency = "BDT",
        payment_system = ["bkash_b", "nagad_b", "upay"],
        buttons = [400, 500, 1000, 2000],
        language = "BN",
        account_number,

        email,
      } = req.body;

      console.log("createPaymentPage req.body", req.body);

      if (!req.user) {
        return apiResponse.ErrorResponse(res, "User authentication required");
      }

      const user = await db("users").where({ id: req.user.id }).first();
      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      const depositMode = await this.getDepositMode();
      console.log(`📊 Current deposit mode: ${depositMode}`);

      // ... (existing validation code) ...

      const customTransactionId = `DEPOSIT_${uuidv4().substring(0, 8)}`;
      const customUserId = `USER_${req.user.id}`;

      // Create transaction with INITIATED status
      await db("transactions").insert({
        user_id: req.user.id,
        amount: amount ? parseFloat(amount) : 0,
        currency,
        transactionType: "credit",
        account_number: account_number,
        status: "INITIATED",
        merchant_invoice_number: customTransactionId,
        mode: depositMode,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      const result = await this.apayService.createPaymentPage({
        amount: amount ? parseFloat(amount) : undefined,
        currency,
        paymentSystem: payment_system,
        customUserId,
        phoneNumber: account_number,
        customTransactionId,
        buttons,
        language,
        email,
      });

     

      if (result.success) {
        // Update transaction with payment_id
        await db("transactions")
          .where({ merchant_invoice_number: customTransactionId })
          .update({
            payment_id: result.order_id,
            updated_at: db.fn.now(),
          });

        const responseMessage =
          depositMode === "AUTO"
            ? "Payment page created successfully. Complete the payment to add funds automatically."
            : "Payment page created successfully. Complete the payment; funds will be added after admin approval.";

        return apiResponse.successResponseWithData(res, responseMessage, {
          success: true,
          url: result.url,
          order_id: result.order_id,
          custom_transaction_id: customTransactionId,
          mode: depositMode,
          requiresApproval: depositMode === "MANUAL",
        });
      } else {
        // Update transaction to FAILED if payment page creation fails
        await db("transactions")
          .where({ merchant_invoice_number: customTransactionId })
          .update({
            status: "FAILED",
            updated_at: db.fn.now(),
          });

        return apiResponse.ErrorResponseWithData(
          res,
          "Failed to create payment page",
          result
        );
      }
    } catch (error) {
      console.error("Create Payment Page Error:", error);
      return apiResponse.ErrorResponse(res, error.message);
    }
  };
}

module.exports = new APayController();
