const mongoose = require("mongoose");
const FantasyPoint = require("../../models/FantasyPoint");
const PlayerStat = require("../../models/PlayerStat");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, FANTASYTTEAM, CONTEST } = require("../../utils/responseMsg");

const fantasyPointsController = {
  async createFantasyPoint(req, res) {
    try {
      let {
        action,
        points,
        description,
        conditions,
        points_t20,
        points_odi,
        points_test,
        points_t10,
      } = req.body;

      if (!action || points === undefined) {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.fantasyPointActionRequired
        );
      }

      const existingAction = await FantasyPoint.findOne({ action });
      if (existingAction) {
        return apiResponse.ErrorResponse(
          res,
          `Action ${action} already exists`
        );
      }

      const newFantasyPoint = new FantasyPoint({
        action,
        points,
        description,
        conditions,
        points_t20: points_t20 || 0,
        points_odi: points_odi || 0,
        points_test: points_test || 0,
        points_t10: points_t10 || 0,
      });

      await newFantasyPoint.save();

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.FantasyPointCreatedSuccessfully,
        newFantasyPoint
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllFantasyPoints(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        action = "",
      } = req.body;

      const skip = Math.max(0, parseInt(pageNumber) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      const filter = { status: { $ne: 2 } };

      if (action) {
        filter.action = { $regex: action, $options: "i" };
      }
      if (searchItem) {
        filter.$or = [
          { action: { $regex: searchItem, $options: "i" } },
          { description: { $regex: searchItem, $options: "i" } },
        ];
      }

      const totalRecords = await FantasyPoint.countDocuments(filter);
      const result = await FantasyPoint.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneFantasyPoint(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return apiResponse.ErrorResponse(res, "Invalid ID format");
      }

      const fantasyPoint = await FantasyPoint.findById(id);

      if (!fantasyPoint) {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.fantasyPointNotFound
        );
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        fantasyPoint
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateFantasyPoint(req, res) {
    try {
      const { id, points_t20, points_odi, points_test, points_t10, status, points, description, conditions, action } = req.body;

      if (!id) {
        return apiResponse.ErrorResponse(res, "Fantasy Point ID is required");
      }

      const updateData = {};
      if (points_t20 !== undefined) updateData.points_t20 = Number(points_t20);
      if (points_odi !== undefined) updateData.points_odi = Number(points_odi);
      if (points_test !== undefined) updateData.points_test = Number(points_test);
      if (points_t10 !== undefined) updateData.points_t10 = Number(points_t10);
      if (status !== undefined) updateData.status = Number(status);
      if (points !== undefined) updateData.points = Number(points);
      if (description !== undefined) updateData.description = description;
      if (conditions !== undefined) updateData.conditions = conditions;
      if (action !== undefined) updateData.action = action;

      const updated = await FantasyPoint.findByIdAndUpdate(id, updateData, { new: true });

      if (!updated) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyPointNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyPointUpdatedSuccessfully,
        updated
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteFantasyPoint(req, res) {
    try {
      const { id } = req.body;

      const updated = await FantasyPoint.findByIdAndUpdate(
        id,
        { status: 2 },
        { new: true }
      );

      if (!updated) {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.fantasyPointNotFound
        );
      }

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyPointDeletedSuccessfully,
        updated
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFantasyPointsByPlayerAndMatch(req, res) {
    try {
      const { playerId, matchId } = req.query;

      if (!playerId || !matchId) {
        return apiResponse.ErrorResponse(
          res,
          CONTEST.playerIdAndMatchIdRequired
        );
      }

      // Using PlayerStat model which was refactored in Phase 2
      const stats = await PlayerStat.findOne({ player: playerId, match: matchId })
        .select("fantasy_points");

      if (!stats) {
        return apiResponse.ErrorResponse(res, CONTEST.noFantasyPointsFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        { fantasy_points: stats.fantasy_points }
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFantasyPointsByMatch(req, res) {
    try {
      const { matchId } = req.query;

      if (!matchId) {
        return apiResponse.ErrorResponse(res, CONTEST.matchIdrequired);
      }

      const stats = await PlayerStat.find({ match: matchId })
        .select("player fantasy_points")
        .sort({ fantasy_points: -1 });

      const formatted = stats.map(s => ({
        player_id: s.player,
        fantasy_points: s.fantasy_points
      }));

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        formatted
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = fantasyPointsController;
