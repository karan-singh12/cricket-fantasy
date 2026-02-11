const mongoose = require("mongoose");
const Wallet = require("../../models/Wallet");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Notification = require("../../models/Notification");
const KycVerification = require("../../models/KycVerification");
const FantasyGame = require("../../models/FantasyGame");
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
    try {
      const { amount } = req.body;

      if (!amount) {
        return apiResponse.ErrorResponse(res, "Valid amount is required");
      }

      const headers = await walletController.bkash_headers();
      const payload = {
        mode: "0011",
        payerReference: `USER_${req.user.id}`,
        callbackURL: config.Bkash.backend_callback_url || "http://localhost:3000/api/user/wallet/payment/callback",
        amount: amount.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: "Inv-" + uuidv4().substring(0, 8),
      };

      const { data } = await axios.post(
        config.Bkash.bkash_create_payment_url || process.env.bkash_create_payment_url,
        payload,
        { headers }
      );

      if (data.statusCode === "0000") {
        try {
          await Transaction.create({
            user: req.user.id,
            title: `Bkash Add Funds - ${payload.merchantInvoiceNumber}`,
            amount: parseFloat(amount),
            currency: payload.currency,
            transactionType: "deposit",
            status: "PENDING",
            metadata: {
              paymentID: data.paymentID,
              merchantInvoiceNumber: payload.merchantInvoiceNumber,
              payerReference: payload.payerReference
            }
          });

          return apiResponse.successResponseWithData(res, "Payment initiated", {
            paymentID: data.paymentID,
            bkashURL: data.bkashURL,
          });
        } catch (dbError) {
          console.error("Database error:", dbError);
          return apiResponse.ErrorResponse(res, "Failed to record transaction");
        }
      } else {
        return apiResponse.ErrorResponseWithData(res, "Payment failed", data);
      }
    } catch (error) {
      console.error("Payment Create Error:", error.response?.data || error.message);
      return apiResponse.ErrorResponseWithData(res, error.message, error?.response?.data || {});
    }
  },

  payment_execute: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { paymentID } = req.body;
      const userId = req.user?.id;

      if (!paymentID) {
        return apiResponse.ErrorResponse(res, "paymentID is required");
      }

      const headers = await walletController.bkash_headers();
      const payload = { paymentID };

      const { data } = await axios.post(
        config.Bkash.bkash_execute_payment_url || process.env.bkash_execute_payment_url,
        payload,
        { headers }
      );

      if (data && data.transactionStatus === "Completed") {
        const amount = parseFloat(data.amount);
        const trxID = data.trxID;

        // Update transaction
        await Transaction.findOneAndUpdate(
          { "metadata.paymentID": paymentID },
          {
            status: "SUCCESS",
            "metadata.trx_id": trxID,
            amount // sometimes amount might change or be confirmed here
          },
          { session }
        );

        // Update user balance (if redundant with Wallet, still mirror original logic if needed)
        await User.findByIdAndUpdate(userId, { $inc: { wallet_balance: amount } }, { session });

        // Update or create Wallet
        let wallet = await Wallet.findOne({ user: userId }).session(session);
        if (wallet) {
          wallet.balance += amount;
          await wallet.save({ session });
        } else {
          await Wallet.create([{ user: userId, balance: amount, currency: "BDT" }], { session });
        }

        // Send Notification
        await Notification.create([{
          user: userId,
          title: "Payment Successful",
          content: `Your payment of BDT ${amount.toFixed(2)} was completed successfully. Transaction ID: ${trxID}`,
          is_read: false,
        }], { session });

        await session.commitTransaction();

        return apiResponse.successResponseWithData(res, "Payment completed and wallet updated", {
          paymentID,
          trxID,
          amount,
        });
      } else {
        await session.abortTransaction();
        return apiResponse.ErrorResponseWithData(res, "Execution failed", data);
      }
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error("Payment Execute Error:", error.response?.data || error.message);
      return apiResponse.ErrorResponseWithData(res, error.message, error?.response?.data || {});
    } finally {
      session.endSession();
    }
  },

  bkash_callback: async (req, res) => {
    const { paymentID, status } = req.query;

    if (!paymentID || !status) {
      return res.status(400).json({ success: false, message: "Invalid callback", status: "error" });
    }

    if (status === "cancel" || status === "failure") {
      return res.status(200).json({ success: false, message: `Payment ${status}`, status, paymentID });
    }

    if (status === "success") {
      try {
        const transaction = await Transaction.findOne({ "metadata.paymentID": paymentID }).lean();

        if (!transaction) {
          return res.status(404).json({ success: false, message: "Transaction not found", status: "error" });
        }

        return res.status(200).json({
          success: true,
          message: "Payment successful",
          status: "success",
          paymentID,
          amount: transaction.amount,
          currency: transaction.currency,
          trxID: transaction.metadata?.trx_id,
        });
      } catch (error) {
        console.error("Callback DB error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", status: "error" });
      }
    }

    return res.status(400).json({ success: false, message: "Unknown status", status: "error" });
  },

  async withdrawFundsBkash(req, res) {
    try {
      const { amount, bkash_mobile } = req.body;

      if (!amount || !bkash_mobile) {
        return apiResponse.ErrorResponse(res, "Amount and bKash number are required");
      }

      const wallet = await Wallet.findOne({ user: req.user.id });
      if (!wallet) return apiResponse.ErrorResponse(res, "Wallet not found");

      const balance = parseFloat(wallet.balance);
      const minBalance = 100;
      const availableToWithdraw = balance - minBalance;

      if (amount > availableToWithdraw) {
        return apiResponse.ErrorResponse(res, `Withdraw limit is ${availableToWithdraw.toFixed(2)} BDT`);
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

      if (data?.statusCode === "0000" || data?.transactionStatus === "Completed") {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const newBalance = (balance - amount).toFixed(2);

          await Wallet.findOneAndUpdate({ user: req.user.id }, { balance: newBalance }, { session });
          await User.findByIdAndUpdate(req.user.id, { wallet_balance: newBalance }, { session });

          await Transaction.create([{
            user: req.user.id,
            title: `bKash withdrawal to ${bkash_mobile}`,
            amount,
            currency: "BDT",
            transactionType: "withdrawal",
            status: "SUCCESS",
            metadata: {
              trx_id: data.trxID || trxID,
              paymentID: data.paymentID || null,
              mobile: bkash_mobile
            }
          }], { session });

          await Notification.create([{
            user: req.user.id,
            title: "bKash Withdrawal Successful",
            content: `You have successfully withdrawn BDT ${parseFloat(amount).toFixed(2)} to bKash number ${bkash_mobile}.`,
            is_read: false,
          }], { session });

          await session.commitTransaction();
          return apiResponse.successResponseWithData(res, "Withdrawal successful", {
            balance: parseFloat(newBalance),
            trxID: data.trxID,
          });
        } catch (innerError) {
          await session.abortTransaction();
          throw innerError;
        } finally {
          session.endSession();
        }
      } else {
        return apiResponse.ErrorResponseWithData(res, "bKash payout failed", data);
      }
    } catch (error) {
      console.error("Withdrawal Error:", error.response?.data || error.message);
      return apiResponse.ErrorResponse(res, WALLET.withdrawalFailed);
    }
  },

  async addFunds(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(req.user.id).session(session);
      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      // Verification check from original code
      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
        return apiResponse.ErrorResponse(res, WALLET.invalidAmount);
      }
      if (amount > 100000) {
        return apiResponse.ErrorResponse(res, WALLET.amountNotBeGreaterThan100000);
      }

      const wallet = await Wallet.findOne({ user: req.user.id }).session(session);
      if (!wallet) {
        throw new Error(USER.accountNotExists);
      }

      const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(2);

      await Wallet.findOneAndUpdate({ user: req.user.id }, { balance: newBalance }, { session });
      await User.findByIdAndUpdate(req.user.id, { wallet_balance: newBalance }, { session });

      await Transaction.create([{
        user: req.user.id,
        title: "Direct Add Funds",
        amount: amount,
        currency: "BDT",
        status: "SUCCESS",
        transactionType: "deposit",
      }], { session });

      await session.commitTransaction();
      return apiResponse.successResponseWithData(res, WALLET.BalanceAdded, {
        wallet: { balance: parseFloat(amount).toFixed(2) },
      });
    } catch (error) {
      await session.abortTransaction();
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    } finally {
      session.endSession();
    }
  },

  async getWalletDetails(req, res) {
    try {
      const wallet = await Wallet.findOne({ user: req.user.id }).lean();
      if (!wallet) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      // In Mongoose, winnings are stored directly in FantasyGame
      const fantasyStats = await FantasyGame.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.user.id), rank: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            contests_won: { $sum: 1 },
            total_winnings: { $sum: "$winnings" }
          }
        }
      ]);

      const totalFantasyWinnings = fantasyStats.length > 0 ? fantasyStats[0].total_winnings : 0;

      const contestWinningsTrx = await Transaction.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.user.id), transactionType: "contest_winnings", status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const totalContestWinnings = contestWinningsTrx.length > 0 ? contestWinningsTrx[0].total : 0;

      const referralBonusResult = await Transaction.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.user.id), transactionType: "referral_bonus", status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const totalReferralBonus = referralBonusResult.length > 0 ? referralBonusResult[0].total : 0;

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        ...wallet,
        id: wallet._id,
        totalWinnings: totalFantasyWinnings + totalContestWinnings,
        referralBonus: totalReferralBonus,
        contests_won: fantasyStats.length > 0 ? fantasyStats[0].contests_won : 0
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
      const skip = (parseInt(pageNumber) - 1) * limit;

      let filter = { user: req.user.id };

      if (searchItem) {
        filter.$or = [
          { transactionType: { $regex: searchItem, $options: "i" } },
          { title: { $regex: searchItem, $options: "i" } },
          { "metadata.description": { $regex: searchItem, $options: "i" } }
        ];
      }

      if (status && status.length > 0) {
        filter.status = { $in: status };
      }

      const transactions = await Transaction.find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

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

        const time = new Date(tx.created_at).toLocaleTimeString("en-us", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).toLowerCase();

        const amountFormatted = parseFloat(tx.amount).toFixed(2);

        if (tx.transactionType === "deposit" || tx.transactionType === "referral_bonus") {
          const depositEntry = {
            title: tx.title || (tx.transactionType === "referral_bonus" ? "Referral Bonus" : `Deposit - ৳${amountFormatted}`),
            time,
            amount: `+ ৳${amountFormatted}`,
            bank: tx.metadata?.bank || "Bkash",
            status: tx.status,
          };
          response.Deposits[date] = response.Deposits[date] || [];
          response.Deposits[date].push(depositEntry);
        } else if (tx.transactionType === "withdrawal") {
          const withdrawEntry = {
            title: tx.title || `Withdraw- ${tx.amount}`,
            time,
            amount: `- ৳${amountFormatted}`,
            bank: tx.metadata?.bank || "Bkash",
            status: tx.status,
          };
          response.Withdraws[date] = response.Withdraws[date] || [];
          response.Withdraws[date].push(withdrawEntry);
        } else if (tx.transactionType === "contest_winnings" || tx.transactionType === "contest_entry") {
          const isFree = parseFloat(tx.amount) === 0;
          const contestEntry = {
            title: tx.title || (tx.transactionType === "contest_winnings" ? "Contest Winnings" : "Contest Entry Fee"),
            time,
            match: tx.metadata?.description || "Fantasy Contest",
            amount: isFree ? "FREE" : (tx.transactionType === "contest_winnings" ? `+ ৳${amountFormatted}` : `- ৳${amountFormatted}`),
            status: tx.status,
          };
          response.Contests[date] = response.Contests[date] || [];
          response.Contests[date].push(contestEntry);
        }
      }

      const groupByDate = (group) => Object.entries(group).map(([date, data]) => ({ date, data }));

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
        return apiResponse.ErrorResponse(res, WALLET.allFieldsAndDocumentsAreRequired);
      }

      const existingKYC = await KycVerification.findOne({
        user: req.user.id,
        status: { $ne: "rejected" }
      });

      if (existingKYC) {
        return apiResponse.ErrorResponse(res, WALLET.KYCAlreadySubmitted);
      }

      const panExists = await KycVerification.findOne({
        user: { $ne: req.user.id },
        $or: [{ pan_number: panNumber }, { pan_name: panName }]
      });

      if (panExists) {
        return apiResponse.ErrorResponse(res, WALLET.PANnumberOrNameAlreadyUsed);
      }

      const kyc = await KycVerification.create({
        user: req.user.id,
        pan_number: panNumber,
        pan_name: panName,
        pan_front_url: panFront.path,
        pan_back_url: panBack.path,
        status: "pending",
      });

      await User.findByIdAndUpdate(req.user.id, { kyc_verified: false }); // Ensure it stays false until verified

      return apiResponse.successResponseWithData(res, WALLET.submittedKYCSuccessfully, { id: kyc._id });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async withdrawFunds(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return apiResponse.ErrorResponse(res, WALLET.invalidAmount);
      }

      const wallet = await Wallet.findOne({ user: req.user.id }).session(session);
      if (!wallet) {
        return apiResponse.ErrorResponse(res, "Wallet not found");
      }

      const currentBalance = parseFloat(wallet.balance);
      const availableToWithdraw = currentBalance - 100;

      if (availableToWithdraw <= 0) {
        return apiResponse.ErrorResponse(res, WALLET.minimumBalance);
      }

      if (amount > availableToWithdraw) {
        return apiResponse.ErrorResponse(res, `You can only withdraw up to ৳${availableToWithdraw.toFixed(2)}`);
      }

      const newBalance = (currentBalance - amount).toFixed(2);

      await Wallet.findOneAndUpdate({ user: req.user.id }, { balance: newBalance }, { session });
      await User.findByIdAndUpdate(req.user.id, { wallet_balance: newBalance }, { session });

      await Transaction.create([{
        user: req.user.id,
        title: "Wallet Withdrawal",
        amount: parseFloat(amount).toFixed(2),
        currency: "BDT",
        transactionType: "withdrawal",
        status: "SUCCESS",
      }], { session });

      await Notification.create([{
        user: req.user.id,
        title: "Withdrawal Successful",
        content: `You have successfully withdrawn ৳${parseFloat(amount).toFixed(2)} from your wallet.`,
        is_read: false,
      }], { session });

      await session.commitTransaction();
      return apiResponse.successResponseWithData(res, WALLET.withdrawalSuccess, {
        wallet: { balance: newBalance },
      });
    } catch (error) {
      await session.abortTransaction();
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    } finally {
      session.endSession();
    }
  },
};

module.exports = walletController;
