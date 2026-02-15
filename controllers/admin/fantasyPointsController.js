const { knex: db } = require("../../config/database");
const config = require("../../config/config");
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator } = require("../../utils/functions");
const {
  ERROR,
  SUCCESS,
  CONTEST,
  FANTASYTTEAM,
} = require("../../utils/responseMsg");

const fantasyPointsController = {
  async createFantasyPoint(req, res) {
    try {
      let {
        action,
        points,
        description,
        conditions,
        
        

      } = req.body;
      

      if (
        !action ||
        !points 
      ) {
        return apiResponse.ErrorResponse(
          res,
          FANTASYTTEAM.fantasyPointActionRequired
        );
      }
      const existingAction = await db("fantasy_points")
        .where({ action })
        .first();

      if (existingAction) {
        return apiResponse.ErrorResponse(
          res,
          `Action ${action} already exists`
        );
      }

    
      const [newFantasyPoint] = await db("fantasy_points")
        .insert({
          action,
          points,
          description,
          conditions: conditions ? JSON.stringify(conditions) : null,
          points_t20: req.body.points_t20 || 0,
    points_odi: req.body.points_odi || 0,
    points_test: req.body.points_test || 0,
    points_t10: req.body.points_t10 || 0,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),

          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");
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

      pageNumber = Math.max(0, pageNumber - 1);
      let query = db("fantasy_points").whereNot("status", 2);

      if (action) {
        query.whereILike("action", `%${action}%`);
      }
      if (searchItem) {
        query.andWhere((builder) =>
          builder
            .whereILike("action", `%${searchItem}%`)
            .orWhereILike("description", `%${searchItem}%`)
        );
      }

      const totalRecords = await query.clone().count().first();

      const result = await query
        .select(
          "*"
        )
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset(pageSize * pageNumber);

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords: parseInt(totalRecords.count),
        pageNumber: pageNumber + 1,
        pageSize,
      });
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneFantasyPoint(req, res) {
    try {
      const { id } = req.params;

      const fantasyPoint = await db("fantasy_points")
        .where({ id })
        .select("*")
        .first();

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
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // async updateFantasyPoint(req, res) {
  //   try {
  //     let {
  //       id,
  //       // action,
  //       // points,
  //       // description,
  //       // conditions,
  //       points_t20,
  //       points_odi,
  //       points_test,
  //       points_t10,
  //       status
  //     } = req.body;

  //     console.log(req.body)

  //     if (!points_t20 || !points_odi  || !points_test || !points_t10 ||  points_t20 === undefined ||
  //       points_odi === undefined ||
  //       points_test === undefined ||
  //       points_t10 === undefined) {
  //       return apiResponse.ErrorResponse(
  //         res,
  //         FANTASYTTEAM.fantasyPointActionRequired
  //       );
  //     }
      

  //     // const existingAction = await db("fantasy_points")
  //     //   .where({ action })
  //     //   .whereNot({ id })
  //     //   .first();

  //     // if (existingAction) {
  //     //   return apiResponse.ErrorResponse(
  //     //     res,
  //     //     `Action ${action} already exists`
  //     //   );
  //     // }

  //     const [updated] = await db("fantasy_points")
  //       .where({ id })
  //       .update({
  //         // action,
  //         // points,
  //         // description,
  //         // conditions: conditions ? JSON.stringify(conditions) : null,
  //         points_t20: points_t20,
  //         points_odi: points_odi,
  //         points_test: points_test,
  //         points_t10: points_t10,
  //         status: Number(status, 1),
  //         updated_at: db.fn.now(),
  //       })
  //       .returning("*");

  //     if (!updated) {
  //       return apiResponse.ErrorResponse(
  //         res,
  //         FANTASYTTEAM.fantasyPointNotFound
  //       );
  //     }

  //     return apiResponse.successResponseWithData(
  //       res,
  //       FANTASYTTEAM.fantasyPointUpdatedSuccessfully,
  //       updated
  //     );
  //   } catch (error) {
  //     console.log(error.message);
  //     return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  //   }
  // },


  async updateFantasyPoint(req, res) {
    try {
      const { id, points_t20, points_odi, points_test, points_t10, status } = req.body;
  
      if (!id) {
        return apiResponse.ErrorResponse(res, "Fantasy Point ID is required");
      }
  
      // Build dynamic update object
      const updateData = {};
      if (points_t20 !== undefined) updateData.points_t20 = Number(points_t20);
      if (points_odi !== undefined) updateData.points_odi = Number(points_odi);
      if (points_test !== undefined) updateData.points_test = Number(points_test);
      if (points_t10 !== undefined) updateData.points_t10 = Number(points_t10);
      if (status !== undefined) updateData.status = Number(status);
  
      // always update timestamp
      updateData.updated_at = db.fn.now();
  
      if (Object.keys(updateData).length === 1) {
        return apiResponse.ErrorResponse(res, "Nothing to update");
      }
  
      const [updated] = await db("fantasy_points")
        .where({ id })
        .update(updateData)
        .returning("*");
  
      if (!updated) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyPointNotFound);
      }
  
      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyPointUpdatedSuccessfully,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },  
  async deleteFantasyPoint(req, res) {
    try {
      const { id } = req.body;

      const [updated] = await db("fantasy_points")
      .where({ id })
      .update({ status: 2, updated_at: db.fn.now() }) 
      .returning("*");

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
      console.log(error.message);
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

      const fantasyPoints = await db("player_stats")
        .where({ player_id: playerId, match_id: matchId })
        .select("fantasy_points")
        .first();

      if (!fantasyPoints) {
        return apiResponse.ErrorResponse(res, CONTEST.noFantasyPointsFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        fantasyPoints
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFantasyPointsByMatch(req, res) {
    try {
      const { matchId } = req.query;

      if (!matchId) {
        return apiResponse.ErrorResponse(res, CONTEST.matchIdrequired);
      }

      const fantasyPoints = await db("player_stats")
        .where({ match_id: matchId })
        .select("player_id", "fantasy_points")
        .orderBy("fantasy_points", "desc");

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        fantasyPoints
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

// Helper function to calculate fantasy points
function calculateFantasyPoints(stats) {
  let points = 0;

  // Batting points
  points += stats.runs_scored * 1; // 1 point per run
  if (stats.runs_scored >= 50) points += 5; // Bonus for half-century
  if (stats.runs_scored >= 100) points += 10; // Bonus for century
  points += stats.fours * 1; // 1 point per four
  points += stats.sixes * 2; // 2 points per six

  // Bowling points
  points += stats.wickets_taken * 25; // 25 points per wicket
  if (stats.wickets_taken >= 3) points += 5; // Bonus for 3+ wickets
  if (stats.wickets_taken >= 5) points += 10; // Bonus for 5+ wickets

  // Fielding points
  points += stats.catches_taken * 10; // 10 points per catch
  points += stats.stumpings * 15; // 15 points per stumping
  points += stats.run_outs * 10; // 10 points per run-out

  return points;
}

module.exports = fantasyPointsController;
