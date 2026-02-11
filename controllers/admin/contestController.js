const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator, listing } = require("../../utils/functions");
const {
  ERROR,
  CONTEST,
  SUCCESS,
  EMAILTEMPLATE,
} = require("../../utils/responseMsg");

const TABLE = "contests";

const contestController = {
  async getAllContests(req, res) {
    try {
      const {
        pageSize = 10,
        pageNumber = 1,
        status = [],
        searchItem = "",
      } = req.body;
  
      const baseQuery = db(TABLE).whereNot("contests.status", "deleted");
  
      if (Array.isArray(status) && status.length > 0) {
        baseQuery.andWhere((builder) =>
          builder.whereIn("contests.status", status)
        );
      }
  
      if (searchItem && searchItem.trim() !== "") {
        baseQuery.andWhere("contests.name", "ilike", `%${searchItem.trim()}%`);
  
        const result = await baseQuery
          .select(
            "contests.id",
            "contests.match_id",
            "contests.name",
            "contests.entry_fee",
            "contests.prize_pool",
            "contests.total_spots",
            "contests.filled_spots",
            "contests.start_time",
            "contests.end_time",
            "contests.per_user_entry",
            "contests.contest_type",
            "contests.winnings",
            "contests.rules",
            "contests.created_by_user",
            "contests.status",
            "contests.created_at",
            "contests.updated_at",
            "tournaments.name as tournament_name",
            "team1.short_name as team1_name",
            "team2.short_name as team2_name"
          )
          .leftJoin("matches", "contests.match_id", "matches.id")
          .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
          .leftJoin("teams as team1", "matches.team1_id", "team1.id")
          .leftJoin("teams as team2", "matches.team2_id", "team2.id")
          .orderBy("contests.created_at", "desc");
  
        const totalRecords = result.length;
  
        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          result,
          totalRecords,
          pageNumber: 1,
          pageSize: totalRecords,
        });
      }
  
      const offset = Math.max(0, pageNumber - 1) * pageSize;
  
      const totalResult = await baseQuery.clone().count("id as count").first();
      const totalRecords = parseInt(totalResult?.count || 0);
  
      const result = await baseQuery
        .select(
          "contests.id",
          "contests.match_id",
          "contests.name",
          "contests.entry_fee",
          "contests.prize_pool",
          "contests.total_spots",
          "contests.filled_spots",
          "contests.start_time",
          "contests.end_time",
          "contests.per_user_entry",
          "contests.contest_type",
          "contests.winnings",
          "contests.rules",
          "contests.created_by_user",
          "contests.status",
          "contests.created_at",
          "contests.updated_at",
          "tournaments.name as tournament_name",
          "team1.short_name as team1_name",
          "team2.short_name as team2_name"
        )
        .leftJoin("matches", "contests.match_id", "matches.id")
        .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
        .leftJoin("teams as team1", "matches.team1_id", "team1.id")
        .leftJoin("teams as team2", "matches.team2_id", "team2.id")
        .orderBy("contests.created_at", "desc")
        .limit(pageSize)
        .offset(offset);
  
      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords,
        pageNumber,
        pageSize,
      });
    } catch (error) {
      console.error("Error in getAllContests:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async createContest(req, res) {
    try {
      const {
        match_id,
        name,
        entry_fee,
        commission_percentage,
        start_time,
        end_time,
        total_spots,
        per_user_entry,
        total_prize_pool,
        contest_type,
        winnings,
      } = req.body;



      // Validate required fields
      if (
        !match_id ||
        !name ||
        entry_fee == null ||
        !start_time ||
        !end_time ||
        !total_spots ||
        !per_user_entry ||
        total_prize_pool == null ||
        !winnings ||
        !contest_type
      ) {
        return apiResponse.ErrorResponse(res, CONTEST.requiredFieldsAreMissing);
      }

      const entryFee = Number(entry_fee);
      const totalSpots = Number(total_spots);
      const totalPrizePool = Number(total_prize_pool);
      const commissionPercentage = Number(commission_percentage || 0);

      // Validate entry fee
      if (entryFee < 0) {
        return apiResponse.ErrorResponse(res, "Entry fee cannot be negative");
      }

      // Validate contest type specific rules
      if (entryFee === 0) {
        // FREE CONTEST validation
        if (totalPrizePool < 0) {
          return apiResponse.ErrorResponse(
            res,
            "For free contests, total prize pool cannot be negative"
          );
        }

        if (commissionPercentage !== 0) {
          return apiResponse.ErrorResponse(
            res,
            "Commission must be 0 for free contests"
          );
        }
      } else {
        // PAID CONTEST validation
        if (!commission_percentage && commission_percentage !== 0) {
          return apiResponse.ErrorResponse(
            res,
            "Commission percentage is required for paid contests"
          );
        }

        if (commissionPercentage < 0 || commissionPercentage > 100) {
          return apiResponse.ErrorResponse(
            res,
            "Commission percentage must be between 0 and 100"
          );
        }

        // Calculate expected prize pool for paid contests
        const totalRevenue = entryFee * totalSpots;
        const commissionAmount = totalRevenue * (commissionPercentage / 100);
        const expectedPrizePool = Math.round(totalRevenue - commissionAmount);

        if (Math.abs(totalPrizePool - expectedPrizePool) > 1) {
          return apiResponse.ErrorResponse(
            res,
            `Prize pool calculation mismatch. Expected: ${expectedPrizePool}, Got: ${totalPrizePool}`
          );
        }
      }

      // Validate match exists and is in correct state
      const match = await db("matches")
        .select("status", "start_time", "tournament_id")
        .where("id", match_id)
        .first();

      if (!match) {
        return apiResponse.ErrorResponse(res, "Match not found");
      }

      if (match.status !== "NS") {
        return apiResponse.ErrorResponse(
          res,
          `Cannot create contest - match is already ${match.status}`
        );
      }

      // Validate dates
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return apiResponse.ErrorResponse(res, "Invalid date format");
      }

      if (endDate <= startDate) {
        return apiResponse.ErrorResponse(res, "End date must be after start date");
      }

      // Validate winnings array
      if (!Array.isArray(winnings) || winnings.length === 0) {
        return apiResponse.ErrorResponse(res, "Winnings breakdown is required");
      }

      // Filter out empty winnings entries
      const validWinnings = winnings.filter(item =>
        item.from && item.to && item.price !== "" &&
        !isNaN(Number(item.from)) && !isNaN(Number(item.to)) && !isNaN(Number(item.price))
      );

      if (validWinnings.length === 0) {
        return apiResponse.ErrorResponse(res, "At least one valid winning entry is required");
      }

      // Sort winnings by 'from' rank
      const sortedWinnings = validWinnings
        .map((w) => ({
          from: Number(w.from),
          to: Number(w.to),
          price: Number(w.price)
        }))
        .sort((a, b) => a.from - b.from);

      // Validate individual winning entries
      for (const item of sortedWinnings) {
        if (item.price < 0) {
          return apiResponse.ErrorResponse(res, "Winning amount cannot be negative");
        }

        if (item.from < 1 || item.to < 1 || item.from > totalSpots || item.to > totalSpots) {
          return apiResponse.ErrorResponse(
            res,
            `Winnings ranks must be within 1 to total spots (${totalSpots})`
          );
        }

        if (item.to < item.from) {
          return apiResponse.ErrorResponse(
            res,
            "Winnings 'to' must be greater than or equal to 'from'"
          );
        }
      }

      // Check for overlapping ranges
      for (let i = 0; i < sortedWinnings.length - 1; i++) {
        const curr = sortedWinnings[i];
        const next = sortedWinnings[i + 1];
        if (curr.to >= next.from) {
          return apiResponse.ErrorResponse(
            res,
            `Winnings ranges overlap: ${curr.from}-${curr.to} and ${next.from}-${next.to}`
          );
        }
      }

      // Build prize breakdown and rules
      const prize_breakup = {};
      const rulesByRange = {};
      let computedTotalPrizePool = 0;

      // Process defined winnings ranges
      for (const item of sortedWinnings) {
        const rangeKey = `${item.from}-${item.to}`;
        rulesByRange[rangeKey] = Number(item.price);

        for (let rank = item.from; rank <= item.to; rank++) {
          if (prize_breakup[`${rank}`] !== undefined) {
            return apiResponse.ErrorResponse(
              res,
              `Duplicate rank detected in winnings: ${rank}`
            );
          }
          prize_breakup[`${rank}`] = Number(item.price);
          computedTotalPrizePool += Number(item.price);
        }
      }

      // Fill uncovered ranks with 0 prize
      let zeroRangeStart = null;
      const zeroRanges = [];

      for (let rank = 1; rank <= totalSpots; rank++) {
        if (prize_breakup[`${rank}`] === undefined) {
          if (zeroRangeStart === null) zeroRangeStart = rank;
          prize_breakup[`${rank}`] = 0;
        } else if (zeroRangeStart !== null) {
          const zeroRangeEnd = rank - 1;
          rulesByRange[`${zeroRangeStart}-${zeroRangeEnd}`] = 0;
          zeroRanges.push({ from: zeroRangeStart, to: zeroRangeEnd, price: 0 });
          zeroRangeStart = null;
        }
      }

      // Handle final zero range if exists
      if (zeroRangeStart !== null) {
        rulesByRange[`${zeroRangeStart}-${totalSpots}`] = 0;
        zeroRanges.push({ from: zeroRangeStart, to: totalSpots, price: 0 });
      }

      // Validate total prize distribution - ONLY FOR PAID CONTESTS
      if (entryFee > 0 && computedTotalPrizePool > totalPrizePool) {
        return apiResponse.ErrorResponse(
          res,
          `Sum of winnings (${computedTotalPrizePool}) cannot exceed total prize pool (${totalPrizePool})`
        );
      }

      const tournament_id = match.tournament_id;

      // Prepare contest data
      const contestData = {
        match_id,
        name: name.trim(),
        entry_fee: entryFee,
        prize_pool: totalPrizePool,
        total_spots: totalSpots,
        filled_spots: 0,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        contest_type,
        per_user_entry: Number(per_user_entry),
        commission_percentage: entryFee === 0 ? 0 : commissionPercentage,
        tournament_id,
        winnings: JSON.stringify([...sortedWinnings, ...zeroRanges].sort((a, b) => a.from - b.from)),
        rules: JSON.stringify(rulesByRange),
        created_by: req.user.id,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      };



      const [contest] = await db("contests").insert(contestData).returning("*");

      return apiResponse.successResponseWithData(res, CONTEST.contestAdded, {
        ...contest,
        entry_fee: contest.entry_fee !== null ? Number(contest.entry_fee) : null,
        winnings:
          typeof contest.winnings === "string"
            ? JSON.parse(contest.winnings)
            : contest.winnings,
        rules:
          typeof contest.rules === "string"
            ? JSON.parse(contest.rules)
            : contest.rules,
      });

    } catch (error) {
      console.error("Error creating contest:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getContestDetails(req, res) {
    try {

      if (!req.params.id) {
        return apiResponse.ErrorResponse(res, "id is required.");
      }

      const result = await db(TABLE)
        .select("contests.*", "tournaments.name as tournament_name")
        .leftJoin("matches", "contests.match_id", "matches.id")
        .leftJoin("tournaments", "matches.tournament_id", "tournaments.id")
        .where("contests.id", req.params.id)
        .first();

      if (!result) {
        return apiResponse.ErrorResponse(res, "Contest not found");
      }

      if (result.start_time) {
        result.start_time_formatted = new Date(result.start_time)
          .toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .replace(",", "");
      }

      if (result.end_time) {
        result.end_time_formatted = new Date(result.end_time)
          .toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .replace(",", "");
      }

      const leaderboard = await db("leaderboard as l")
        .select(
          "l.*",
          "u.name as user_name"
        )
        .leftJoin("users as u", "l.userId", "u.id")
        .where("l.contestId", req.params.id)
        .orderBy("l.rank", "asc");

      const transactions = await db("transactions")
        .select("id", "user_id", "contest_id", "transactionType", "amount", "status")
        .where("contest_id", req.params.id);

      leaderboard.forEach(user => {
        user.transactions = transactions.filter(
          t => t.user_id === user.userId
        );
      });


      result.leaderboard = leaderboard;

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        result
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateContest(req, res) {
    try {

      const {
        id,
        match_id,
        name,
        entry_fee,
        total_prize_pool,
        prize_breakup,
        winnings,
        start_time,
        end_time,
        total_spots,
        contest_type,
        per_user_entry,
      } = req.body;

      // Get current contest
      const currentContest = await db("contests").where("id", id).first();

      if (!currentContest) {
        return res.status(404).json({ error: "Contest not found" });
      }

      // Prevent update if contest has entries
      if (currentContest.filled_spots > 0) {
        return res
          .status(400)
          .json({ error: "Cannot update contest with existing entries" });
      }

      // Optional: Validate match (only if updating match_id)
      if (match_id && match_id !== currentContest.match_id) {
        const match = await db("matches")
          .where("id", match_id)
          .where("status", "NS")
          .first();

        if (!match) {
          return res
            .status(400)
            .json({ error: "Invalid match ID or match already started" });
        }
      }

      // Validate prize breakup sum
      if (prize_breakup) {
        const totalPrizeBreakup = Object.values(prize_breakup).reduce(
          (a, b) => a + b,
          0
        );
        if (totalPrizeBreakup !== total_prize_pool) {
          return apiResponse.ErrorResponse(
            res,
            CONTEST.prizeBreakupTotalMustMatchTotalPrizePool
          );
        }
      }

      // Update contest
      const [updatedContest] = await db("contests")
        .where("id", id)
        .update({
          match_id,
          name,
          entry_fee,
          prize_pool: total_prize_pool,
          total_spots,
          start_time,
          end_time,
          per_user_entry,
          contest_type,
          winnings: winnings
            ? JSON.stringify(winnings)
            : currentContest.winnings,
          rules: prize_breakup || currentContest.rules,
          updated_at: db.fn.now(),
        })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        CONTEST.contestUpdated,
        updatedContest
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateContestStatus(req, res) {
    try {
      const { id } = req.body;
      const { status } = req.body;

      if (!id || !status) {
        return apiResponse.validationErrorWithData(
          res,
          USER.missingRequiredFields
        );
      }

      const allowedStatuses = ["upcoming", "running", "completed"];
      if (!allowedStatuses.includes(status)) {
        return apiResponse.validationErrorWithData(
          res,
          `${USER.invalidStatusValue
          }. Allowed statuses are: ${allowedStatuses.join(", ")}`
        );
      }

      const [updated] = await db("contests")
        .where({ id })
        .update({ status, updated_at: db.fn.now() })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(
          res,
          EMAILTEMPLATE.templateNotFoundOrNotUpdated
        );
      }

      return apiResponse.successResponseWithData(
        res,
        `Status updated to ${status}`,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updatePrizeBreakup(req, res) {
    try {
      const { id } = req.params;
      const { prize_breakup } = req.body;

      // Get current contest
      const contest = await db("contests").where("id", id).first();

      if (!contest) {
        return res.status(404).json({ error: "Contest not found" });
      }

      // Don't allow updates if contest has entries
      if (contest.current_entries > 0) {
        return res
          .status(400)
          .json({ error: "Cannot update prize breakup with existing entries" });
      }

      // Validate prize breakup total
      const totalPrizeBreakup = Object.values(prize_breakup).reduce(
        (a, b) => a + b,
        0
      );
      if (totalPrizeBreakup !== contest.total_prize_pool) {
        return res
          .status(400)
          .json({ error: "Prize breakup total must equal total prize pool" });
      }

      const [updatedContest] = await db("contests")
        .where("id", id)
        .update({
          prize_breakup,
          updated_at: db.fn.now(),
        })
        .returning("*");

      res.json(updatedContest);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteContest(req, res) {
    try {
      const { id } = req.body;

      // Check if contest has entries
      const contest = await db("contests").where("id", id).first();

      if (!contest) {
        return res.status(404).json({ error: "Contest not found" });
      }

      await db("contests").where({ id: id }).update({
        status: "deleted",
        updated_at: db.fn.now(),
      });

      return apiResponse.successResponse(res, CONTEST.contestDeleted);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = contestController;
