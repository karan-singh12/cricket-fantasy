const { knex: db } = require("../../config/database");
const config = require("../../config/config");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, USER, SUCCESS, WALLET } = require("../../utils/responseMsg");
const axios = require("axios");
const aws4 = require("aws4");
const url = require("url");
const { getPayoutToken } = require("../../utils/payoutTokenManager");

const { v4: uuidv4 } = require("uuid");

const globals = new Map();

const walletController = {
  grantToken: async () => {
    const headers = {
      Accept: "application/json",
      username: config.Bkash.bkash_username || process.env.bkash_username,
      password: config.Bkash.bkash_password || process.env.bkash_password,
      "Content-Type": "application/json",
    };

    const body = {
      app_key: config.Bkash.bkash_api_key || process.env.bkash_api_key,
      app_secret: config.Bkash.bkash_secret_key || process.env.bkash_secret_key,
    };

    try {
      const { data } = await axios.post(
        config.Bkash.bkash_grant_token_url || process.env.bkash_grant_token_url,
        body,
        { headers }
      );
      globals.set("id_token", data.id_token);
      return data.id_token;
    } catch (err) {
      console.error("Token Grant Error:", err.response?.data || err.message);
      throw err;
    }
  },

  bkash_headers: async () => {
    let token = globals.get("id_token");
    if (!token) {
      token = await walletController.grantToken();
    }

    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: token,
      "x-app-key": config.Bkash.bkash_api_key || process.env.bkash_api_key,
    };
  },

  payment_create: async (req, res) => {
    console.log("payment_create");
    try {
      const { amount } = req.body;

      if (!amount) {
        return apiResponse.ErrorResponse(res, "Valid amount is required");
      }

      const headers = await walletController.bkash_headers();
      const payload = {
        mode: "0011",
        payerReference: `USER_${req.user.id}`,
        callbackURL:
          config.Bkash.backend_callback_url ||
          "http://localhost:3000/api/user/wallet/payment/callback",
        amount: amount.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: "Inv-" + uuidv4().substring(0, 8),
      };

      const { data } = await axios.post(
        config.Bkash.bkash_create_payment_url ||
        process.env.bkash_create_payment_url,
        payload,
        { headers }
      );

      console.log("Payment creation response:", data);

      if (data.statusCode === "0000") {
        try {
          const trx = await db.transaction();
          const transactionData = {
            user_id: req.user.id,
            amount: parseFloat(amount),
            currency: payload.currency,
            transactionType: "credit",
            status: "INITIATED",
            payment_id: data.paymentID,
            trx_id: null,
            merchant_invoice_number: payload.merchantInvoiceNumber,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          };
          console.log("Inserting transaction with data:", transactionData);
          await trx("transactions").insert(transactionData);
          await trx.commit();
          console.log("Transaction record created successfully");
          return apiResponse.successResponseWithData(res, "Payment initiated", {
            paymentID: data.paymentID,
            bkashURL: data.bkashURL,
          });
        } catch (dbError) {
          console.error("Database transaction error:", dbError);
          return apiResponse.ErrorResponse(res, "Failed to record transaction");
        }
      } else {
        return apiResponse.ErrorResponseWithData(res, "Payment failed", data);
      }
    } catch (error) {
      console.error(
        "Payment Create Error:",
        error.response?.data || error.message
      );
      return apiResponse.ErrorResponseWithData(
        res,
        error.message,
        error?.response?.data || {}
      );
    }
  },

  payment_execute: async (req, res) => {
    console.log("payment_execute");
    const trx = await db.transaction();
    try {
      const { paymentID } = req.body;
      const userId = req.user?.id;

      if (!paymentID || paymentID.length === 0) {
        return apiResponse.ErrorResponse(res, "paymentID is required");
      }

      const headers = await walletController.bkash_headers();
      const payload = { paymentID };

      const { data } = await axios.post(
        config.Bkash.bkash_execute_payment_url ||
        process.env.bkash_execute_payment_url,
        payload,
        { headers }
      );

      if (data && data.transactionStatus === "Completed") {
        const amount = parseFloat(data.amount);
        const trxID = data.trxID;

        console.log("yha tak");

        await trx("transactions").where({ payment_id: paymentID }).update({
          amount,
          trx_id: trxID,
          status: "SUCCESS",
          updated_at: trx.fn.now(),
        });

        await trx("users")
          .where({ id: userId })
          .increment("wallet_balance", amount);

        const walletExists = await trx("wallet")
          .where({ user_id: userId })
          .first();
        console.log("walletExists", walletExists);

        if (walletExists) {
          await trx("wallet")
            .where({ user_id: userId })
            .increment("balance", amount)
            .update({ updated_at: trx.fn.now() });
        } else {
          await trx("wallet").insert({
            user_id: userId,
            balance: amount,
            currency: "BDT",
          });
        }
        await db("notifications").insert({
          user_id: userId,
          title: "Payment Successful",
          content: `Your payment of BDT ${amount.toFixed(
            2
          )} was completed successfully. Transaction ID: ${trxID}`,
          is_read: false,
          sent_at: db.fn.now(),
          created_at: db.fn.now(),
        });

        await trx.commit();

        return apiResponse.successResponseWithData(
          res,
          "Payment completed and wallet updated",
          {
            paymentID,
            trxID,
            amount,
          }
        );
      } else {
        await trx.rollback();
        return apiResponse.ErrorResponseWithData(res, "Execution failed", data);
      }
    } catch (error) {
      await trx.rollback();
      console.error(
        "Payment Execute Error:",
        error.response?.data || error.message
      );
      return apiResponse.ErrorResponseWithData(
        res,
        error.message,
        error?.response?.data || {}
      );
    }
  },

  bkash_callback: async (req, res) => {
    const { paymentID, status } = req.query;

    if (!paymentID || !status) {
      return res.status(400).json({
        success: false,
        message: "Invalid callback",
        status: "error",
      });
    }

    if (status === "cancel" || status === "failure") {
      return res.status(200).json({
        success: false,
        message: `Payment ${status}`,
        status,
        paymentID,
      });
    }

    if (status === "success") {
      try {
        const transaction = await db("transactions")
          .where({ payment_id: paymentID })
          .first();

        if (!transaction) {
          return res.status(404).json({
            success: false,
            message: "Transaction not found",
            status: "error",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Payment successful",
          status: "success",
          paymentID,
          amount: transaction.amount,
          currency: transaction.currency,
          trxID: transaction.trx_id,
        });
      } catch (error) {
        console.error("Callback DB error:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
          status: "error",
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: "Unknown status",
      status: "error",
    });
  },

  async withdrawFundsBkash(req, res) {
    try {
      const { amount, bkash_mobile } = req.body;

      if (!amount || !bkash_mobile) {
        return apiResponse.ErrorResponse(
          res,
          "Amount and bKash number are required"
        );
      }

      const wallet = await db("wallet").where("user_id", req.user.id).first();
      if (!wallet) return apiResponse.ErrorResponse(res, "Wallet not found");

      const balance = parseFloat(wallet.balance);
      const minBalance = 100;
      const availableToWithdraw = balance - minBalance;

      if (amount > availableToWithdraw) {
        return apiResponse.ErrorResponse(
          res,
          `Withdraw limit is ${availableToWithdraw.toFixed(2)} BDT`
        );
      }

      const token = await getPayoutToken();

      const trxID = "WD-" + uuidv4().substring(0, 8);
      const payload = {
        amount: amount.toFixed(2),
        mobile: bkash_mobile,
        trxID,
        paymentReason: "User Withdraw",
      };

      const parsedUrl = url.parse(config.BkashDisbursement.disburse_url);

      const opts = {
        host: parsedUrl.host,
        path: parsedUrl.path,
        service: "execute-api",
        region: config.BkashDisbursement.aws_region || "ap-southeast-1",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-key": config.BkashDisbursement.app_key,
          authorization: token,
        },
        body: JSON.stringify(payload),
      };

      // Sign the request
      aws4.sign(opts, {
        accessKeyId: config.BkashDisbursement.access_key,
        secretAccessKey: config.BkashDisbursement.secret_access_key,
      });

      const { data } = await axios({
        method: "POST",
        url: config.BkashDisbursement.disburse_url,
        headers: opts.headers,
        data: payload,
      });

      if (
        data?.statusCode === "0000" ||
        data?.transactionStatus === "Completed"
      ) {
        const newBalance = balance - amount;

        await db("wallet")
          .where("user_id", req.user.id)
          .update({
            balance: newBalance.toFixed(2),
            updated_at: db.fn.now(),
          });

        await db("users")
          .where("id", req.user.id)
          .update({
            wallet_balance: newBalance.toFixed(2),
            updated_at: db.fn.now(),
          });

        await db("transactions").insert({
          user_id: req.user.id,
          amount,
          currency: "BDT",
          transactionType: "debit",
          status: "SUCCESS",
          trx_id: data.trxID || trxID,
          payment_id: data.paymentID || null,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
          description: `bKash withdrawal to ${bkash_mobile}`,
        });
        await db("notifications").insert({
          user_id: req.user.id,
          title: "bKash Withdrawal Successful",
          content: `You have successfully withdrawn BDT ${parseFloat(
            amount
          ).toFixed(2)} to bKash number ${bkash_mobile}.`,
          is_read: false,
          sent_at: db.fn.now(),
          created_at: db.fn.now(),
        });

        return apiResponse.successResponseWithData(
          res,
          "Withdrawal successful",
          {
            balance: newBalance,
            trxID: data.trxID,
          }
        );
      } else {
        return apiResponse.ErrorResponseWithData(
          res,
          "bKash payout failed",
          data
        );
      }
    } catch (error) {
      console.error("Withdrawal Error:", error.response?.data || error.message);
      return apiResponse.ErrorResponse(res, WALLET.withdrawalFailed);
    }
  },

  async addFunds(req, res) {
    try {
      const user = await db("users").where({ id: req.user.id }).first();
      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }
      if (!user.is_verified && !user.kyc_verified) {
        return apiResponse.ErrorResponse(res, USER.accountNotVerified);
      }

      const { amount } = req.body;

      if (!amount || isNaN(amount) || amount <= 0) {
        return apiResponse.ErrorResponse(res, WALLET.invalidAmount);
      }
      if (amount > 100000) {
        return apiResponse.ErrorResponse(
          res,
          WALLET.amountNotBeGreaterThan100000
        );
      }

      await db.transaction(async (trx) => {
        const wallet = await trx("wallet")
          .where("user_id", req.user.id)
          .first();
        if (!wallet) {
          throw new Error(USER.accountNotExists);
        }

        const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
        await trx("wallet")
          .where("user_id", req.user.id)
          .update({
            balance: newBalance.toFixed(2),
            updated_at: db.fn.now(),
          });
        await trx("users")
          .where({ id: req.user.id })
          .update({
            wallet_balance: newBalance.toFixed(2),
            updated_at: db.fn.now(),
          });
        await trx("transactions").insert({
          user_id: parseInt(req.user.id),
          amount: amount,
          currency: "BDT",
          status: "SUCCESS",
          transactionType: "credit",
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
      });

      return apiResponse.successResponseWithData(res, WALLET.BalanceAdded, {
        wallet: {
          balance: parseFloat(amount).toFixed(2),
        },
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Direct DB methods
  async getWalletDetails(req, res) {
    try {
      const wallet = await db("wallet")
        .where("user_id", req.user.id)
        .select("*")
        .first();
  
      if (!wallet) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }
  
      // Contest winnings from fantasy_games table (rank-based)
      const winningsResult = await db("fantasy_games as fg")
        .join("contests as c", "fg.contest_id", "c.id")
        .where("fg.user_id", req.user.id)
        .where("fg.rank", ">", 0)
        .select(
          db.raw("COUNT(*) as contests_won"),
          db.raw(`
            SUM(
              CASE 
                WHEN fg.rank = 1 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'1')::numeric 
                WHEN fg.rank = 2 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'2')::numeric
                WHEN fg.rank = 3 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'3')::numeric
                ELSE 0 
              END
            ) as total_winnings
          `)
        )
        .first();
  
      // Contest winnings from transactions table
      const contestWinningsResult = await db("transactions")
        .where("user_id", req.user.id)
        .andWhere("transactionType", "contest_winning")
        .sum("amount as total_contest_winnings")
        .first();
  
      // Referral bonus
      const referralBonusResult = await db("transactions")
        .where("user_id", req.user.id)
        .andWhere("transactionType", "referral_bonus")
        .sum("amount as total_referral_bonus")
        .first();
  
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        ...wallet,
        totalWinnings:
          (parseFloat(winningsResult.total_winnings) || 0) +
          (parseFloat(contestWinningsResult.total_contest_winnings) || 0),
        referralBonus:
          parseFloat(referralBonusResult.total_referral_bonus) || 0,
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  

  async getAllTransactions(req, res) {
    try {
      const { pageSize = 100, pageNumber = 1, searchItem, status } = req.body;
      const limit = parseInt(pageSize);
      const offset = (parseInt(pageNumber) - 1) * limit;

      let query = db("transactions")
        .where("user_id", req.user.id)
        .orderBy("created_at", "desc");

      if (searchItem) {
        query = query.where(function () {
          this.where("transactionType", "like", `%${searchItem}%`)
            .orWhere("currency", "like", `%${searchItem}%`)
            .orWhere("description", "like", `%${searchItem}%`);
        });
      }

      if (status && status.length > 0) {
        query.whereIn("status", status);
      }

      const transactions = await query
        .select("id", "amount", "transactionType", "created_at", "status","title","bank")
        .limit(limit)
        .offset(offset);

   
    

      const response = {
        Contests: {},
        Deposits: {},
        Withdraws: {},
      };

      for (const tx of transactions) {
        const date = new Date(tx.created_at).toLocaleDateString("en-us", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

        const time = new Date(tx.created_at)
          .toLocaleTimeString("en-us", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .toLowerCase();

          if (
            tx.transactionType === "credit" ||
            tx.transactionType === "referral_bonus"
          ) {
            const depositEntry = {
              title:
                tx.transactionType === "referral_bonus"
                  ?  tx.title || "Referral Bonus"
                  : tx.title || `Deposit - ৳${parseFloat(tx.amount).toFixed(2)}`,
              time,
              amount: `+ ৳${parseFloat(tx.amount).toFixed(2)}`,
              bank: tx.bank || "Bkash",
              status: tx.status,
            };
            response.Deposits[date] = response.Deposits[date] || [];
            response.Deposits[date].push(depositEntry);
        } else if (tx.transactionType === "debit" || tx.transactionType === "withdraw") {
          const withdrawEntry = {
            title: `Withdraw- ${tx.amount}` || tx.title,
            time,
            amount: `- ৳${parseFloat(tx.amount).toFixed(2)}`,
            bank: tx.bank || "Bkash",
            status: tx.status,
            
          };
          response.Withdraws[date] = response.Withdraws[date] || [];
          response.Withdraws[date].push(withdrawEntry);
        }else if (tx.transactionType === "contest_winning" || tx.transactionType === "contest_spend") {
          const isFree = parseFloat(tx.amount) === 0;
        
          const contestEntry = {
            title: tx.transactionType === "contest_winning" 
                      ? `Contest Winnings | ${tx.title}` 
                      : `Contest Entry Fee | ${tx.title}`,
            time,
            match: tx.description || "Fantasy Contest",
            amount: isFree 
                      ? "FREE" 
                      : tx.transactionType === "contest_winning" 
                        ? `+ ৳${parseFloat(tx.amount).toFixed(2)}` 
                        : `- ৳${parseFloat(tx.amount).toFixed(2)}`,
            status: tx.status,
          };
        
          response.Contests[date] = response.Contests[date] || [];
          response.Contests[date].push(contestEntry);
        }
        
      }

      const groupByDate = (group) =>
        Object.entries(group).map(([date, data]) => ({ date, data }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        Contests: groupByDate(response.Contests),
        Deposits: groupByDate(response.Deposits),
        Withdraws: groupByDate(response.Withdraws),
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async kycVefication(req, res) {
    try {
      const { panNumber, panName } = req.body;
      const panFront = req.files?.panFront?.[0];
      const panBack = req.files?.panBack?.[0];

      if (!panFront || !panBack || !panNumber || !panName) {
        return apiResponse.ErrorResponse(
          res,
          WALLET.allFieldsAndDocumentsAreRequired
        );
      }

      const existingKYC = await db("kyc_verification")
        .where({ userId: req.user.id })
        .whereNot("status", "rejected")
        .first();

      if (existingKYC) {
        return apiResponse.ErrorResponse(res, WALLET.KYCAlreadySubmitted);
      }

      const panExists = await db("kyc_verification")
        .whereNot({ userId: req.user.id })
        .andWhere(function () {
          this.where("pan_number", panNumber).orWhere("pan_name", panName);
        })
        .first();

      if (panExists) {
        return apiResponse.ErrorResponse(
          res,
          WALLET.PANnumberOrNameAlreadyUsed
        );
      }

      const insertData = {
        userId: req.user.id,
        pan_number: panNumber,
        pan_name: panName,
        pan_front_url: panFront.path,
        pan_back_url: panBack.path,
        status: "pending",
        created_at: new Date(),
      };

      const [insertedId] = await db("kyc_verification")
        .insert(insertData)
        .returning("id");

      await db("users").where("id", req.user.id).update({
        kyc_document: insertedId.id,
        updated_at: new Date(),
      });

      return apiResponse.successResponseWithData(
        res,
        WALLET.submittedKYCSuccessfully,
        { id: insertedId.id }
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async withdrawFunds(req, res) {
    try {
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return apiResponse.ErrorResponse(res, WALLET.invalidAmount);
      }

      const wallet = await db("wallet").where("user_id", req.user.id).first();

      if (!wallet) {
        return apiResponse.ErrorResponse(res, "Wallet not found");
      }

      const currentBalance = parseFloat(wallet.balance);
      const availableToWithdraw = currentBalance - 100;

      if (availableToWithdraw <= 0) {
        return apiResponse.ErrorResponse(res, WALLET.minimumBalance);
      }

      if (amount > availableToWithdraw) {
        return apiResponse.ErrorResponse(
          res,
          `You can only withdraw up to ৳${availableToWithdraw.toFixed(2)}`
        );
      }

      const newBalance = currentBalance - amount;

      await db("wallet")
        .where("user_id", req.user.id)
        .update({
          balance: newBalance.toFixed(2),
          updated_at: db.fn.now(),
        });

      await db("users")
        .where({ id: req.user.id })
        .update({
          wallet_balance: newBalance.toFixed(2),
          updated_at: db.fn.now(),
        });

      await db("transactions").insert({
        user_id: req.user.id,
        amount: parseFloat(amount).toFixed(2),
        currency: "BDT",
        transactionType: "debit",
        status: "SUCCESS",
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      await db("notifications").insert({
        user_id: req.user.id,
        title: "Withdrawal Successful",
        content: `You have successfully withdrawn ৳${parseFloat(amount).toFixed(
          2
        )} from your wallet.`,
        is_read: false,
        sent_at: db.fn.now(),
        created_at: db.fn.now(),
      });

      return apiResponse.successResponseWithData(
        res,
        WALLET.withdrawalSuccess,
        {
          wallet: {
            balance: newBalance.toFixed(2),
          },
        }
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = walletController;
