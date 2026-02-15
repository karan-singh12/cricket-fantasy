const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { listing } = require("../../utils/functions");
const { ERROR, FAQ, SUCCESS, FANTASYTTEAM } = require("../../utils/responseMsg");

const teamManagerController = {
  async getAllFantasyTeams(req, res) {
    try {
      let { pageSize, pageNumber, searchItem = "" } = req.body;
     

      let query = db("fantasy_teams as ft")
        .select(
          "ft.id as fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points",
          "ft.status as team_status",
          "ft.match_id",
          "ft.user_id",
          "ft.created_at as created_at",
          "u.name as user_name",
          "u.email as user_email",
          
          "m.start_time as match_start_time",
          "t1.short_name as team1_short_name",
          "t2.short_name as team2_short_name"
        )
        .leftJoin("users as u", "ft.user_id", "u.id")
        .leftJoin("matches as m", "ft.match_id", "m.id")
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .where("u.is_bot", false)

      if (searchItem) {
        query = query.where(function () {
          this.where("ft.name", "ilike", `%${searchItem}%`)
            .orWhere("u.name", "ilike", `%${searchItem}%`)
            .orWhere("u.email", "ilike", `%${searchItem}%`);
        });
      }

      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;

      if (shouldPaginate) {
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const pageOffset = Math.max(0, pageNumber - 1);

        const totalRecordsResult = await query
          .clone()
          .clearSelect()
          .countDistinct("ft.id as count")
          .first();
        const totalRecords = parseInt(totalRecordsResult.count) || 0;

        const result = await query.orderBy("ft.created_at", "desc")

          .limit(pageSize)
          .offset(pageSize * pageOffset);

        const data = result;

        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          data,
          totalRecords,
          pageNumber,
          pageSize,
          totalPages: Math.ceil(totalRecords / pageSize),
        });
      } else {
        const result = await query;
        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          data: result,
          totalRecords: result.length,
          paginated: false,
        });
      }
    } catch (error) {
      console.error("getAllFantasyTeams error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async getAllBotFantasyTeams(req, res) {
    try {
      let { pageSize, pageNumber, searchItem = "" } = req.body;

      let query = db("fantasy_teams as ft")
        .select(
          "ft.id as fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points",
          "ft.status as team_status",
          "ft.match_id",
          "ft.user_id",
          "ft.created_at as created_at",
          "u.name as user_name",
          "u.email as user_email",
          "u.is_bot as bot",
          "m.start_time as match_start_time",
          "t1.short_name as team1_short_name",
          "t2.short_name as team2_short_name"
        )
        .leftJoin("users as u", "ft.user_id", "u.id")
        .leftJoin("matches as m", "ft.match_id", "m.id")
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .where("u.is_bot", true); // ✅ Only bot users

      if (searchItem) {
        query = query.where(function () {
          this.where("ft.name", "ilike", `%${searchItem}%`)
            .orWhere("u.name", "ilike", `%${searchItem}%`)
            .orWhere("u.email", "ilike", `%${searchItem}%`);
        });
      }

      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;

      if (shouldPaginate) {
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const pageOffset = Math.max(0, pageNumber - 1);

        const totalRecordsResult = await query
          .clone()
          .clearSelect()
          .countDistinct("ft.id as count")
          .first();
        const totalRecords = parseInt(totalRecordsResult.count) || 0;

        const result = await query.orderBy("ft.created_at", "desc")
          .limit(pageSize)
          .offset(pageSize * pageOffset);

        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          data: result,
          totalRecords,
          pageNumber,
          pageSize,
          totalPages: Math.ceil(totalRecords / pageSize),
        });
      } else {
        const result = await query;
        return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
          data: result,
          totalRecords: result.length,
          paginated: false,
        });
      }
    } catch (error) {
      console.error("getAllBotFantasyTeams error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  

  // async getFantasyTeamById(req, res) {
  //   try {
  //     const { id } = req.params;
  //     if (!id) {
  //       return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamIdRequired);
  //     }

  //     const team = await db("fantasy_teams as ft")
  //       .select(
  //         "ft.id as fantasy_team_id",
  //         "ft.name as fantasy_team_name",
  //         "ft.total_points",
  //         "ft.status as team_status",
  //         "ft.match_id",
  //         "ft.user_id",
  //         "u.name as user_name",
  //         "u.email as user_email",
  //         "m.start_time as match_start_time",
  //         "t1.short_name as team1_short_name",
  //         "t2.short_name as team2_short_name"
  //       )
  //       .leftJoin("users as u", "ft.user_id", "u.id")
  //       .leftJoin("matches as m", "ft.match_id", "m.id")
  //       .leftJoin("teams as t1", "m.team1_id", "t1.id")
  //       .leftJoin("teams as t2", "m.team2_id", "t2.id")
  //       .where("ft.id", id)
  //       .first();
  //     if (!team) {
  //       return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFound);
  //     }

  //     const players = await db("fantasy_team_players as ftp")
  //       .select(
  //         "ftp.player_id",
  //         "ftp.is_captain",
  //         "ftp.is_vice_captain",
  //         "ftp.substitute",
  //         "p.name as player_name",
  //         "p.role as player_role",
  //         "pt.team_id as player_team_id",
  //         "t.name as player_team_name",
  //         "t.short_name as player_team_short_name",
  //         db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
  //       )
  //       .join("players as p", "ftp.player_id", "p.id")
  //       .leftJoin("player_teams as pt", "p.id", "pt.player_id")
  //       .leftJoin("teams as t", "pt.team_id", "t.id")
  //       .where("ftp.fantasy_team_id", id)
  //       .orderBy("ftp.substitute", "asc")
  //       .orderBy("ftp.id", "asc");
  //     return apiResponse.successResponseWithData(
  //       res,
  //       FANTASYTTEAM.fantasyTeamsFetchedSuccessfully,
  //       {
  //         ...team,
  //         players,
  //       }
  //     );
  //   } catch (error) {
  //     console.error("getFantasyTeamById error:", error);
  //     return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
  //   }
  // },
  async getFantasyTeamById(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamIdRequired);
      }
  
      const team = await db("fantasy_teams as ft")
        .select(
          "ft.id as fantasy_team_id",
          "ft.name as fantasy_team_name",
          "ft.total_points",
          "ft.status as team_status",
          "ft.match_id",
          "ft.user_id",
          "ft.contest_id",
          "u.name as user_name",
          "u.email as user_email",
          "m.start_time as match_start_time",
          "t1.short_name as team1_short_name",
          "t2.short_name as team2_short_name"
        )
        .leftJoin("users as u", "ft.user_id", "u.id")
        .leftJoin("matches as m", "ft.match_id", "m.id")
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .where("ft.id", id)
        .first();
      
      if (!team) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFound);
      }
  
      // For PostgreSQL, use DISTINCT ON to get only one team per player for this match
      const players = await db("fantasy_team_players as ftp")
  .distinctOn("ftp.player_id")
  .select(
    "ftp.player_id",
    "ftp.is_captain",
    "ftp.is_vice_captain",
    "ftp.substitute",
    "p.name as player_name",
    "p.role as player_role",
    "pt.team_id as player_team_id",
    "t.name as player_team_name",
    "t.short_name as player_team_short_name",
    db.raw("COALESCE(p.metadata->>'image_path', null) as image_path")
  )
  .join("players as p", "ftp.player_id", "p.id")
  .leftJoin("player_teams as pt", "p.id", "pt.player_id") // <-- removed match_id filter
  .leftJoin("teams as t", "pt.team_id", "t.id")
  .where("ftp.fantasy_team_id", id)
  .orderBy("ftp.player_id")
  .orderBy("ftp.substitute", "asc")
  .orderBy("ftp.id", "asc");
  
      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyTeamsFetchedSuccessfully,
        {
          ...team,
          players,
        }
      );
    } catch (error) {
      console.error("getFantasyTeamById error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = teamManagerController;
