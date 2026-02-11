const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const Transaction = require("../../models/Transaction");
const Notification = require("../../models/Notification");
const NotificationTemplate = require("../../models/NotificationTemplate");
const ReferralSetting = require("../../models/ReferralSetting");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS } = require("../../utils/responseMsg");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");

const referralController = {
  async getReferralSettings(req, res) {
    try {
      let settings = await ReferralSetting.findOne();

      if (!settings) {
        settings = await ReferralSetting.create({
          is_active: true,
          referrer_bonus: 100.0,
          referee_bonus: 100.0,
          max_referrals_per_user: 0,
          min_referee_verification: true,
          bonus_currency: "BDT",
        });
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        settings
      );
    } catch (error) {
      console.error("Error in getReferralSettings:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateReferralSettings(req, res) {
    try {
      const {
        is_active,
        referrer_bonus,
        referee_bonus,
        max_referrals_per_user,
        min_referee_verification,
        bonus_currency,
      } = req.body;

      if (referrer_bonus === undefined || referee_bonus === undefined) {
        return apiResponse.ErrorResponse(
          res,
          "referrer_bonus and referee_bonus are required"
        );
      }

      const updateData = {
        is_active: is_active !== undefined ? is_active : true,
        referrer_bonus: parseFloat(referrer_bonus),
        referee_bonus: parseFloat(referee_bonus),
        max_referrals_per_user: max_referrals_per_user !== undefined ? parseInt(max_referrals_per_user) : 0,
        min_referee_verification: min_referee_verification !== undefined ? min_referee_verification : true,
        bonus_currency: bonus_currency || "BDT",
      };

      const settings = await ReferralSetting.findOneAndUpdate({}, updateData, { upsert: true, new: true });

      return apiResponse.successResponseWithData(
        res,
        "Referral settings updated successfully",
        settings
      );
    } catch (error) {
      console.error("Error in updateReferralSettings:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getReferralStats(req, res) {
    try {
      const { start_date, end_date } = req.body;

      const filter = { referred_by: { $ne: null } };
      if (start_date && end_date) {
        filter.created_at = { $gte: new Date(start_date), $lte: new Date(end_date) };
      }

      const totalReferrals = await User.countDocuments(filter);

      const distinctReferrers = await User.distinct("referred_by", filter);
      const totalReferrers = distinctReferrers.length;

      const bonusResult = await Transaction.aggregate([
        { $match: { transactionType: "referral_bonus", status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const totalBonusPaid = bonusResult.length > 0 ? bonusResult[0].total : 0;

      const monthlyReferrals = await User.aggregate([
        { $match: { referred_by: { $ne: null } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 6 },
        { $project: { month: "$_id", count: 1, _id: 0 } }
      ]);

      const topReferrers = await User.aggregate([
        { $match: { referred_by: { $ne: null } } },
        { $group: { _id: "$referred_by", referral_count: { $sum: 1 } } },
        { $sort: { referral_count: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "referrer"
          }
        },
        { $unwind: "$referrer" },
        {
          $lookup: {
            from: "transactions",
            let: { refId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$user", "$$refId"] },
                      { $eq: ["$transactionType", "referral_bonus"] },
                      { $eq: ["$status", "SUCCESS"] }
                    ]
                  }
                }
              },
              { $group: { _id: null, total: { $sum: "$amount" } } }
            ],
            as: "bonus"
          }
        },
        {
          $project: {
            id: "$_id",
            name: "$referrer.name",
            email: "$referrer.email",
            phone: "$referrer.phone",
            referral_code: "$referrer.referral_code",
            referral_count: 1,
            total_bonus_earned: { $ifNull: [{ $arrayElemAt: ["$bonus.total", 0] }, 0] }
          }
        }
      ]);

      const stats = {
        total_referrals: totalReferrals,
        total_referrers: totalReferrers,
        total_bonus_paid: totalBonusPaid,
        monthly_referrals: monthlyReferrals,
        top_referrers: topReferrers,
      };

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, stats);
    } catch (error) {
      console.error("Error in getReferralStats:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllReferrals(req, res) {
    try {
      const {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "desc",
        referrer_id,
        status = [],
      } = req.body;

      const limit = parseInt(pageSize) || 10;
      const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

      const filter = { referred_by: { $ne: null } };

      if (referrer_id) {
        filter.referred_by = referrer_id;
      }

      if (status.length > 0) {
        filter.status = { $in: status.map(Number) };
      }

      if (searchItem) {
        // This search might be tricky with referenced fields in Mongoose find
        // We might need an aggregation for full search flexibility
        filter.$or = [
          { name: { $regex: searchItem, $options: "i" } },
          { email: { $regex: searchItem, $options: "i" } }
        ];
      }

      const totalRecords = await User.countDocuments(filter);
      const result = await User.find(filter)
        .populate("referred_by", "name email phone")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const enrichedResult = await Promise.all(
        result.map(async (user) => {
          const referralsMade = await User.countDocuments({ referred_by: user._id });
          const bonusResult = await Transaction.aggregate([
            { $match: { user: user._id, transactionType: "referral_bonus", status: "SUCCESS" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ]);
          const bonusEarned = bonusResult.length > 0 ? bonusResult[0].total : 0;

          return {
            ...user,
            id: user._id,
            referrer_name: user.referred_by?.name,
            referrer_email: user.referred_by?.email,
            referrals_made: referralsMade,
            bonus_earned: bonusEarned,
          };
        })
      );

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: enrichedResult,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
        totalPages: Math.ceil(totalRecords / limit),
      });
    } catch (error) {
      console.error("Error in getAllReferrals:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getReferrerDetails(req, res) {
    try {
      const { referrer_id } = req.params;

      const referrer = await User.findById(referrer_id)
        .select("name email phone referral_code created_at")
        .lean();

      if (!referrer) {
        return apiResponse.ErrorResponse(res, "Referrer not found");
      }

      const referralsCount = await User.countDocuments({ referred_by: referrer_id });

      const bonusResult = await Transaction.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(referrer_id), transactionType: "referral_bonus", status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const totalBonus = bonusResult.length > 0 ? bonusResult[0].total : 0;

      const recentReferrals = await User.find({ referred_by: referrer_id })
        .select("name email phone is_verified created_at")
        .sort({ created_at: -1 })
        .limit(10)
        .lean();

      const referralTransactions = await Transaction.find({
        user: referrer_id,
        transactionType: "referral_bonus"
      })
        .select("amount status created_at")
        .sort({ created_at: -1 })
        .limit(10)
        .lean();

      const referrerDetails = {
        ...referrer,
        id: referrer._id,
        referrals_count: referralsCount,
        total_bonus_earned: totalBonus,
        recent_referrals: recentReferrals.map(r => ({ ...r, id: r._id })),
        referral_transactions: referralTransactions.map(t => ({ ...t, id: t._id })),
      };

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        referrerDetails
      );
    } catch (error) {
      console.error("Error in getReferrerDetails:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getReferralAnalytics(req, res) {
    try {
      const { period = "30" } = req.body;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      const dailyReferrals = await User.aggregate([
        { $match: { referred_by: { $ne: null }, created_at: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } }
      ]);

      const conversionStatsResult = await User.aggregate([
        { $match: { created_at: { $gte: startDate } } },
        {
          $facet: {
            totalReferrers: [
              { $match: { referred_by: { $ne: null } } },
              { $group: { _id: "$referred_by" } },
              { $count: "count" }
            ],
            totalReferrals: [
              { $match: { referred_by: { $ne: null } } },
              { $count: "count" }
            ]
          }
        },
        {
          $project: {
            total_referrers: { $ifNull: [{ $arrayElemAt: ["$totalReferrers.count", 0] }, 0] },
            total_referrals: { $ifNull: [{ $arrayElemAt: ["$totalReferrals.count", 0] }, 0] }
          }
        },
        {
          $project: {
            total_referrers: 1,
            total_referrals: 1,
            avg_referrals_per_referrer: {
              $cond: [{ $eq: ["$total_referrers", 0] }, 0, { $divide: ["$total_referrals", "$total_referrers"] }]
            }
          }
        }
      ]);

      const topReferralCodes = await User.aggregate([
        { $match: { referred_by: { $ne: null }, created_at: { $gte: startDate } } },
        { $group: { _id: "$referred_by", referral_count: { $sum: 1 } } },
        { $sort: { referral_count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "referrer"
          }
        },
        { $unwind: "$referrer" },
        {
          $project: {
            referral_code: "$referrer.referral_code",
            name: "$referrer.name",
            email: "$referrer.email",
            referral_count: 1,
            _id: 0
          }
        }
      ]);

      const bonusDistribution = await Transaction.aggregate([
        { $match: { transactionType: "referral_bonus", status: "SUCCESS", created_at: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            total_bonus: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", total_bonus: 1, _id: 0 } }
      ]);

      const analytics = {
        period_days: parseInt(period),
        daily_referrals: dailyReferrals,
        conversion_stats: conversionStatsResult.length > 0 ? conversionStatsResult[0] : {},
        top_referral_codes: topReferralCodes,
        bonus_distribution: bonusDistribution,
      };

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        analytics
      );
    } catch (error) {
      console.error("Error in getReferralAnalytics:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async addReferralBonus(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { user_id, amount, reason } = req.body;

      if (!user_id || !amount || !reason) {
        return apiResponse.ErrorResponse(
          res,
          "User ID, amount, and reason are required"
        );
      }

      const user = await User.findById(user_id).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, "User not found");
      }

      const bonusAmount = parseFloat(amount);
      const userWallet = await Wallet.findOne({ user: user_id }).session(session);
      if (!userWallet) {
        await session.abortTransaction();
        session.endSession();
        return apiResponse.ErrorResponse(res, "User wallet not found");
      }

      const newBalance = userWallet.balance + bonusAmount;
      userWallet.balance = newBalance;
      user.wallet_balance = newBalance;

      const template = await NotificationTemplate.findOne({ slug: "Referral-Bonus-Added", status: 1 }).session(session);
      const title = template?.title || "Referral Bonus Added";
      const content = (template?.content || "You received {{bonusAmount}} for {{reason}}")
        .replace("{{bonusAmount}}", bonusAmount)
        .replace("{{reason}}", reason);

      await userWallet.save({ session });
      await user.save({ session });

      await Transaction.create([{
        user: user_id,
        amount: bonusAmount,
        currency: "BDT",
        status: "SUCCESS",
        transactionType: "referral_bonus",
        payment_id: `MANUAL_BY_ADMIN${Date.now()}`,
      }], { session });

      await Notification.create([{
        user: user_id,
        title: title,
        content: content,
        is_read: false,
        sent_at: new Date(),
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return apiResponse.successResponse(
        res,
        "Referral bonus added successfully"
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in addReferralBonus:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async exportReferralData(req, res) {
    try {
      const { start_date, end_date, format = "pdf" } = req.body;

      const filter = { referred_by: { $ne: null } };
      if (start_date && end_date) {
        filter.created_at = { $gte: new Date(start_date), $lte: new Date(end_date) };
      }

      const referrals = await User.find(filter)
        .populate("referred_by", "name email phone")
        .sort({ created_at: -1 })
        .lean();

      if (format === "pdf") {
        const doc = new PDFDocument({ size: "A3", margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="referrals.pdf"'
        );

        doc.pipe(res);

        doc.fontSize(18).text("Referral Data Report", { align: "center" });
        doc.moveDown(1);

        const headers = [
          "User Name",
          "User Email",
          "User Phone",
          "Referral Code",
          "Referred By",
          "Referrer Name",
          "Referrer Email",
          "Referrer Phone",
          "Is Verified",
          "Created At",
        ];

        const colWidths = [60, 150, 80, 78, 60, 60, 150, 80, 50, 80];

        const tableTop = 120;
        const tableLeft = 0;
        const rowHeight = 45;
        const cellPadding = 10;

        doc.fontSize(12).font("Helvetica-Bold");
        headers.forEach((header, i) => {
          doc.text(
            header,
            tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
            tableTop,
            { width: colWidths[i], align: "center" }
          );
        });

        doc
          .moveTo(tableLeft, tableTop + rowHeight)
          .lineTo(
            tableLeft + colWidths.reduce((a, b) => a + b, 0),
            tableTop + rowHeight
          )
          .strokeColor("#000000")
          .lineWidth(1)
          .stroke();

        doc.fontSize(10).font("Helvetica");
        referrals.forEach((ref, rowIndex) => {
          const rowData = [
            ref.name || "NA",
            ref.email || "NA",
            ref.phone || "NA",
            ref.referral_code || "NA",
            ref.referred_by?._id?.toString() || "NA",
            ref.referred_by?.name || "NA",
            ref.referred_by?.email || "NA",
            ref.referred_by?.phone || "NA",
            ref.is_verified ? "Yes" : "No",
            ref.created_at.toISOString().split("T")[0],
          ];

          rowData.forEach((cell, colIndex) => {
            doc.text(
              cell,
              tableLeft +
              colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0) +
              cellPadding,
              tableTop + (rowIndex + 1) * rowHeight + cellPadding,
              {
                width: colWidths[colIndex] - cellPadding * 2,
                align: "left",
              }
            );
          });
        });

        doc.end();
        return;
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        format: "json",
        data: referrals,
        total_records: referrals.length,
      });
    } catch (err) {
      console.log(err);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = referralController;
