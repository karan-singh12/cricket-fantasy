const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS } = require("../../utils/responseMsg");
const PDFDocument = require("pdfkit");

const referralController = {
  async getReferralSettings(req, res) {
    try {
      const settings = await db("referral_settings").first();

      if (!settings) {
        const defaultSettings = {
          is_active: true,
          referrer_bonus: 100.0,
          referee_bonus: 100.0,
          max_referrals_per_user: 0,
          min_referee_verification: true,
          bonus_currency: "BDT",
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        };

        const [newSettings] = await db("referral_settings")
          .insert(defaultSettings)
          .returning("*");

        return apiResponse.successResponseWithData(
          res,
          SUCCESS.dataFound,
          newSettings
        );
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
        apiResponse.ErrorResponse(
          res,
          "referrer_bonus and referee_bonus are required"
        );
        return;
      }

      if (
        isNaN(parseFloat(referrer_bonus)) ||
        isNaN(parseFloat(referee_bonus))
      ) {
        return apiResponse.ErrorResponse(
          res,
          "referrer_bonus and referee_bonus must be valid numbers"
        );
        return;
      }

      const updateData = {
        updated_at: db.fn.now(),
        is_active: is_active !== undefined ? is_active : true,
        referrer_bonus: parseFloat(referrer_bonus),
        referee_bonus: parseFloat(referee_bonus),
        max_referrals_per_user:
          max_referrals_per_user !== undefined
            ? parseInt(max_referrals_per_user)
            : 0,
        min_referee_verification:
          min_referee_verification !== undefined
            ? min_referee_verification
            : true,
        bonus_currency: bonus_currency || "BDT",
      };

      const existingSettings = await db("referral_settings").first();

      let updatedSettings;
      if (existingSettings) {
        [updatedSettings] = await db("referral_settings")
          .update(updateData)
          .returning("*");
      } else {
        [updatedSettings] = await db("referral_settings")
          .insert({
            ...updateData,
            created_at: db.fn.now(),
          })
          .returning("*");
      }

      return apiResponse.successResponseWithData(
        res,
        "Referral settings updated successfully",
        updatedSettings
      );
    } catch (error) {
      console.error("Error in updateReferralSettings:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getReferralStats(req, res) {
    try {
      const { start_date, end_date } = req.body;

      let query = db("users").whereNotNull("referred_by");
      if (start_date && end_date) {
        query = query.whereBetween("created_at", [start_date, end_date]);
      }

      const totalReferrals = await query.clone().count("* as count").first();

     

      const totalReferrers = await db("users")
        .whereExists(function () {
          this.select("*")
            .from("users as u2")
            .whereRaw("CAST(u2.referred_by AS INTEGER) = users.id");
        })
        .count("* as count")
        .first();

      const totalBonusPaid = await db("transactions")
        .where('"transactionType"', "referral_bonus")
        .where("status", "SUCCESS")
        .sum("amount as total")
        .first();

      const monthlyReferrals = await db("users")
        .whereNotNull("referred_by")
        .select(
          db.raw("DATE_TRUNC('month', created_at) as month"),
          db.raw("COUNT(*) as count")
        )
        .groupBy("month")
        .orderBy("month", "desc")
        .limit(6);

      const topReferrers = await db("users as u1")
        .select(
          "u1.id",
          "u1.name",
          "u1.email",
          "u1.phone",
          "u1.referral_code",
          db.raw("COUNT(u2.id) as referral_count"),
          db.raw("COALESCE(SUM(t.amount), 0) as total_bonus_earned")
        )
        .leftJoin("users as u2", function () {
          this.on(db.raw("CAST(u2.referred_by AS INTEGER)"), "=", "u1.id");
        })
        .leftJoin("transactions as t", function () {
          this.on("t.user_id", "=", "u1.id")
            .andOn('t."transactionType"', "=", db.raw("'referral_bonus'"))
            .andOn("t.status", "=", db.raw("'SUCCESS'"));
        })
        .groupBy("u1.id", "u1.name", "u1.email", "u1.phone", "u1.referral_code")
        .orderBy("referral_count", "desc")
        .limit(3);

      const stats = {
        total_referrals: parseInt(totalReferrals.count) || 0,
        total_referrers: parseInt(totalReferrers.count) || 0,
        total_bonus_paid: parseFloat(totalBonusPaid.total) || 0,
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

      let query = db("users as u1")
        .select(
          "u1.id",
          "u1.name",
          "u1.email",
          "u1.phone",
          "u1.referral_code",
          "u1.referred_by",
          "u1.is_verified",
          "u1.created_at",
          "u2.name as referrer_name",
          "u2.email as referrer_email"
        )
        .leftJoin("users as u2", function () {
          this.on(db.raw("CAST(u1.referred_by AS INTEGER)"), "=", "u2.id");
        })
        .whereNotNull("u1.referred_by");

      if (referrer_id) {
        query.andWhere(db.raw("CAST(u1.referred_by AS INTEGER)"), referrer_id);
      }

      if (status.length > 0) {
        query.andWhere("u1.status", status);
      }

      if (searchItem) {
        query.andWhere(function (builder) {
          builder
            .whereILike("u1.name", `%${searchItem}%`)
            .orWhereILike("u1.email", `%${searchItem}%`)
            .orWhereILike("u2.name", `%${searchItem}%`)
            .orWhereILike("u2.email", `%${searchItem}%`);
        });
      }

      // Calculate total records
      const totalRecordsQuery = db("users as u1")
        .whereNotNull("u1.referred_by")
        .count("* as count")
        .first();

      if (referrer_id) {
        totalRecordsQuery.andWhere(
          db.raw("CAST(u1.referred_by AS INTEGER)"),
          referrer_id
        );
      }

      if (status.length > 0) {
        totalRecordsQuery.andWhere("u1.status", status);
      }

      if (searchItem) {
        totalRecordsQuery
          .andWhere(function (builder) {
            builder
              .whereILike("u1.name", `%${searchItem}%`)
              .orWhereILike("u1.email", `%${searchItem}%`)
              .orWhereILike("u2.name", `%${searchItem}%`)
              .orWhereILike("u2.email", `%${searchItem}%`);
          })
          .leftJoin("users as u2", function () {
            this.on(db.raw("CAST(u1.referred_by AS INTEGER)"), "=", "u2.id");
          });
      }

      const totalRecords = await totalRecordsQuery;

      const offset = (pageNumber - 1) * pageSize;
      const result = await query
        .orderBy(sortBy, sortOrder)
        .limit(pageSize)
        .offset(offset);

      // Add additional data for each result
      const enrichedResult = await Promise.all(
        result.map(async (user) => {
          // Get referrals made by this user
          const referralsMade = await db("users")
            .where(db.raw("CAST(referred_by AS INTEGER)"), user.id)
            .count("* as count")
            .first();

          // Get bonus earned by this user (fixed column reference)
          const bonusEarned = await db("transactions")
            .where("user_id", user.id)
            .where("transactionType", "referral_bonus") // Removed quotes
            .where("status", "SUCCESS")
            .sum("amount as total")
            .first();

          return {
            ...user,
            referrals_made: parseInt(referralsMade.count) || 0,
            bonus_earned: parseFloat(bonusEarned.total) || 0,
          };
        })
      );

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: enrichedResult,
        totalRecords: parseInt(totalRecords.count),
        pageNumber,
        pageSize,
        totalPages: Math.ceil(parseInt(totalRecords.count) / pageSize),
      });
    } catch (error) {
      console.error("Error in getAllReferrals:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getReferrerDetails(req, res) {
    try {
      const { referrer_id } = req.params;

      const referrer = await db("users")
        .where("id", referrer_id)
        .select("id", "name", "email", "phone", "referral_code", "created_at")
        .first();

      if (!referrer) {
        return apiResponse.ErrorResponse(res, "Referrer not found");
      }

      const referralsCount = await db("users")
        .where(db.raw("CAST(referred_by AS INTEGER)"), referrer_id)
        .count("* as count")
        .first();

      const totalBonus = await db("transactions")
        .where("user_id", referrer_id)
        .where("transactionType", "referral_bonus")
        .where("status", "SUCCESS")
        .sum("amount as total")
        .first();

      const recentReferrals = await db("users")
        .where(db.raw("CAST(referred_by AS INTEGER)"), referrer_id)
        .select("id", "name", "email", "phone", "is_verified", "created_at")
        .orderBy("created_at", "desc")
        .limit(10);

      const referralTransactions = await db("transactions")
        .where("user_id", referrer_id)
        .where("transactionType", "referral_bonus")
        .select("id", "amount", "status", "created_at")
        .orderBy("created_at", "desc")
        .limit(10);

      const referrerDetails = {
        ...referrer,
        referrals_count: parseInt(referralsCount.count) || 0,
        total_bonus_earned: parseFloat(totalBonus.total) || 0,
        recent_referrals: recentReferrals,
        referral_transactions: referralTransactions,
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
      const { period = "30" } = req.body; // days

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Daily referrals for the period
      const dailyReferrals = await db("users")
        .whereNotNull("referred_by")
        .where("created_at", ">=", startDate)
        .select(db.raw("DATE(created_at) as date"), db.raw("COUNT(*) as count"))
        .groupBy("date")
        .orderBy("date", "asc");

      // Referral conversion rate (referrals per referrer) - Fix: Cast referred_by to integer
      const conversionStats = await db.raw(
        `
        SELECT 
          COUNT(DISTINCT u1.id) as total_referrers,
          COUNT(u2.id) as total_referrals,
          ROUND(COUNT(u2.id)::numeric / NULLIF(COUNT(DISTINCT u1.id), 0), 2) as avg_referrals_per_referrer
        FROM users u1
        LEFT JOIN users u2 ON u1.id = CAST(u2.referred_by AS INTEGER)
        WHERE u1.created_at >= ?
      `,
        [startDate]
      );

      // Top performing referral codes - Fix: Cast referred_by to integer
      const topReferralCodes = await db("users as u1")
        .select(
          "u1.referral_code",
          "u1.name",
          "u1.email",
          db.raw("COUNT(u2.id) as referral_count")
        )
        .leftJoin("users as u2", function () {
          this.on(db.raw("CAST(u2.referred_by AS INTEGER)"), "=", "u1.id");
        })
        .where("u2.created_at", ">=", startDate)
        .groupBy("u1.referral_code", "u1.name", "u1.email")
        .orderBy("referral_count", "desc")
        .limit(10);

      // Referral bonus distribution
      const bonusDistribution = await db("transactions")
        .where("transactionType", "referral_bonus")
        .where("status", "SUCCESS")
        .where("created_at", ">=", startDate)
        .select(
          db.raw("DATE(created_at) as date"),
          db.raw("SUM(amount) as total_bonus")
        )
        .groupBy("date")
        .orderBy("date", "asc");

      const analytics = {
        period_days: parseInt(period),
        daily_referrals: dailyReferrals,
        conversion_stats: conversionStats.rows[0] || {},
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
    try {
      const { user_id, amount, reason } = req.body;

      if (!user_id || !amount || !reason) {
        return apiResponse.ErrorResponse(
          res,
          "User ID, amount, and reason are required"
        );
      }

      const user = await db("users").where("id", user_id).first();
      if (!user) {
        return apiResponse.ErrorResponse(res, "User not found");
      }

      const bonusAmount = parseFloat(amount);

      const userWallet = await db("wallet").where("user_id", user_id).first();
      if (!userWallet) {
        return apiResponse.ErrorResponse(res, "User wallet not found");
      }

      const newBalance = parseFloat(userWallet.balance) + bonusAmount;
      const template = await db("notification_templates")
      .where({ slug: "Referral-Bonus-Added", status: 1 })
      .first();
      const title = template.title || "Referral Bonus Added";
    const content = (template.content || "")
      .replace("{{bonusAmount}}", bonusAmount)
      .replace("{{reason}}", reason);

    if (!template) {
      return apiResponse.ErrorResponse(res, "Notification template not found");
    }

      await db.transaction(async (trx) => {
        await trx("wallet")
          .where("user_id", user_id)
          .update({
            balance: newBalance.toFixed(2),
            updated_at: trx.fn.now(),
          });

        await trx("users")
          .where("id", user_id)
          .update({
            wallet_balance: newBalance.toFixed(2),
            updated_at: trx.fn.now(),
          });

        await trx("transactions").insert({
          user_id: user_id,
          amount: bonusAmount,
          currency: "BDT",
          status: "SUCCESS",
          transactionType: "referral_bonus",
          payment_id: `MANUAL_BY_ADMIN${Date.now()}`,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });

        await trx("notifications").insert({
          user_id: user_id,
          title: title,
          content: content,
          is_read: false,
          sent_at: trx.fn.now(),
          created_at: trx.fn.now(),
        });
      });
    

      return apiResponse.successResponse(
        res,
        "Referral bonus added successfully"
      );
    } catch (error) {
      console.error("Error in addReferralBonus:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async exportReferralData(req, res) {
    try {
      const { start_date, end_date, format = "pdf" } = req.body;

      let query = db("users as u1")
        .select(
          "u1.id",
          "u1.name",
          "u1.email",
          "u1.phone",
          "u1.referral_code",
          "u1.referred_by",
          "u1.is_verified",
          "u1.created_at",
          "u2.name as referrer_name",
          "u2.email as referrer_email",
          "u2.phone as referrer_phone"
        )
        .leftJoin("users as u2", function () {
          this.on(db.raw("CAST(u1.referred_by AS INTEGER)"), "=", "u2.id");
        })
        .whereNotNull("u1.referred_by");

      if (start_date && end_date) {
        query.andWhereBetween("u1.created_at", [start_date, end_date]);
      }

      const referrals = await query.orderBy("u1.created_at", "desc");

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

        // Draw headers
        doc.fontSize(12).font("Helvetica-Bold");
        headers.forEach((header, i) => {
          doc.text(
            header,
            tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
            tableTop,
            { width: colWidths[i], align: "center" }
          );
        });

        // Draw header separator
        doc
          .moveTo(tableLeft, tableTop + rowHeight)
          .lineTo(
            tableLeft + colWidths.reduce((a, b) => a + b, 0),
            tableTop + rowHeight
          )
          .strokeColor("#000000")
          .lineWidth(1)
          .stroke();

        // Draw rows
        doc.fontSize(10).font("Helvetica");
        referrals.forEach((ref, rowIndex) => {
          const rowData = [
            ref.name || "NA",
            ref.email || "NA",
            ref.phone || "NA",
            ref.referral_code || "NA",
            ref.referred_by || "NA",
            ref.referrer_name || "NA",
            ref.referrer_email || "NA",
            ref.referrer_phone || "NA",
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

        // Draw table grid
        referrals.forEach((_, rowIndex) => {
          doc
            .moveTo(tableLeft, tableTop + (rowIndex + 1) * rowHeight)
            .lineTo(
              tableLeft + colWidths.reduce((a, b) => a + b, 0),
              tableTop + (rowIndex + 1) * rowHeight
            )
            .strokeColor("#CCCCCC")
            .lineWidth(0.5)
            .stroke();

          headers.forEach((_, colIndex) => {
            doc
              .moveTo(
                tableLeft +
                  colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0),
                tableTop
              )
              .lineTo(
                tableLeft +
                  colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0),
                tableTop + (referrals.length + 1) * rowHeight
              )
              .strokeColor("#CCCCCC")
              .lineWidth(0.5)
              .stroke();
          });
        });

        // Finalize the PDF
        doc.end();

        return;
      }

      // JSON format (unchanged)
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        format: "json",
        data: referrals,
        total_records: referrals.length,
      });
    } catch (err) {
      console.log(err);
    }
  },
};

module.exports = referralController;
