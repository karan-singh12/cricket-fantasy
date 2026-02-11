const FantasyTeam = require("../../models/FantasyTeam");
const User = require("../../models/User");
const Match = require("../../models/Match");
const Team = require("../../models/Team");
const Player = require("../../models/Player");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, FANTASYTTEAM } = require("../../utils/responseMsg");
const mongoose = require("mongoose");

const teamManagerController = {
  async getAllFantasyTeams(req, res) {
    try {
      let { pageSize, pageNumber, searchItem = "" } = req.body;

      const pipeline = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user_info",
          },
        },
        { $unwind: "$user_info" },
        { $match: { "user_info.is_bot": false } },
        {
          $lookup: {
            from: "matches",
            localField: "match",
            foreignField: "_id",
            as: "match_info",
          },
        },
        { $unwind: { path: "$match_info", preserveNullAndEmptyArrays: true } },
      ];

      if (searchItem) {
        pipeline.push({
          $match: {
            $or: [
              { name: { $regex: searchItem, $options: "i" } },
              { "user_info.name": { $regex: searchItem, $options: "i" } },
              { "user_info.email": { $regex: searchItem, $options: "i" } },
            ],
          },
        });
      }

      const totalResult = await FantasyTeam.aggregate([...pipeline, { $count: "total" }]);
      const totalRecords = totalResult.length > 0 ? totalResult[0].total : 0;

      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;
      if (shouldPaginate) {
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const skip = (pageNumber - 1) * pageSize;
        pipeline.push({ $sort: { created_at: -1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: pageSize });
      } else {
        pipeline.push({ $sort: { created_at: -1 } });
      }

      const result = await FantasyTeam.aggregate(pipeline);

      const formattedResult = await Promise.all(
        result.map(async (ft) => {
          let team1_short_name = "";
          let team2_short_name = "";
          if (ft.match_info) {
            const t1 = await Team.findById(ft.match_info.team1).select("short_name").lean();
            const t2 = await Team.findById(ft.match_info.team2).select("short_name").lean();
            team1_short_name = t1?.short_name || "";
            team2_short_name = t2?.short_name || "";
          }

          return {
            fantasy_team_id: ft._id,
            fantasy_team_name: ft.name,
            total_points: ft.total_points,
            team_status: ft.status || 1,
            match_id: ft.match,
            user_id: ft.user,
            created_at: ft.created_at,
            user_name: ft.user_info.name,
            user_email: ft.user_info.email,
            match_start_time: ft.match_info?.start_time,
            team1_short_name,
            team2_short_name,
          };
        })
      );

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        data: formattedResult,
        totalRecords,
        pageNumber: shouldPaginate ? pageNumber : 1,
        pageSize: shouldPaginate ? pageSize : formattedResult.length,
        paginated: shouldPaginate,
        totalPages: shouldPaginate ? Math.ceil(totalRecords / pageSize) : 1,
      });
    } catch (error) {
      console.error("getAllFantasyTeams error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllBotFantasyTeams(req, res) {
    try {
      let { pageSize, pageNumber, searchItem = "" } = req.body;

      const pipeline = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user_info",
          },
        },
        { $unwind: "$user_info" },
        { $match: { "user_info.is_bot": true } },
        {
          $lookup: {
            from: "matches",
            localField: "match",
            foreignField: "_id",
            as: "match_info",
          },
        },
        { $unwind: { path: "$match_info", preserveNullAndEmptyArrays: true } },
      ];

      if (searchItem) {
        pipeline.push({
          $match: {
            $or: [
              { name: { $regex: searchItem, $options: "i" } },
              { "user_info.name": { $regex: searchItem, $options: "i" } },
              { "user_info.email": { $regex: searchItem, $options: "i" } },
            ],
          },
        });
      }

      const totalResult = await FantasyTeam.aggregate([...pipeline, { $count: "total" }]);
      const totalRecords = totalResult.length > 0 ? totalResult[0].total : 0;

      const shouldPaginate = pageSize !== undefined && pageNumber !== undefined;
      if (shouldPaginate) {
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 1;
        const skip = (pageNumber - 1) * pageSize;
        pipeline.push({ $sort: { created_at: -1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: pageSize });
      } else {
        pipeline.push({ $sort: { created_at: -1 } });
      }

      const result = await FantasyTeam.aggregate(pipeline);

      const formattedResult = await Promise.all(
        result.map(async (ft) => {
          let team1_short_name = "";
          let team2_short_name = "";
          if (ft.match_info) {
            const t1 = await Team.findById(ft.match_info.team1).select("short_name").lean();
            const t2 = await Team.findById(ft.match_info.team2).select("short_name").lean();
            team1_short_name = t1?.short_name || "";
            team2_short_name = t2?.short_name || "";
          }

          return {
            fantasy_team_id: ft._id,
            fantasy_team_name: ft.name,
            total_points: ft.total_points,
            team_status: ft.status || 1,
            match_id: ft.match,
            user_id: ft.user,
            created_at: ft.created_at,
            user_name: ft.user_info.name,
            user_email: ft.user_info.email,
            match_start_time: ft.match_info?.start_time,
            team1_short_name,
            team2_short_name,
          };
        })
      );

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        data: formattedResult,
        totalRecords,
        pageNumber: shouldPaginate ? pageNumber : 1,
        pageSize: shouldPaginate ? pageSize : formattedResult.length,
        paginated: shouldPaginate,
        totalPages: shouldPaginate ? Math.ceil(totalRecords / pageSize) : 1,
      });
    } catch (error) {
      console.error("getAllBotFantasyTeams error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFantasyTeamById(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamIdRequired);
      }

      const team = await FantasyTeam.findById(id)
        .populate("user", "name email")
        .populate("match")
        .populate("players.player")
        .lean();

      if (!team) {
        return apiResponse.ErrorResponse(res, FANTASYTTEAM.fantasyTeamNotFound);
      }

      let team1_short_name = "";
      let team2_short_name = "";

      if (team.match) {
        const t1 = await Team.findById(team.match.team1).select("short_name").lean();
        const t2 = await Team.findById(team.match.team2).select("short_name").lean();
        team1_short_name = t1?.short_name || "";
        team2_short_name = t2?.short_name || "";
      }

      const formattedPlayers = team.players.map((p) => ({
        player_id: p.player?.sportmonks_id,
        player_name: p.player?.name,
        player_role: p.player?.role,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        substitute: p.is_substitute ? 1 : 0,
        image_path: p.player?.image_url || null,
        // player_team info might need additional lookup if not embedded in Player
      }));

      return apiResponse.successResponseWithData(
        res,
        FANTASYTTEAM.fantasyTeamsFetchedSuccessfully,
        {
          fantasy_team_id: team._id,
          fantasy_team_name: team.name,
          total_points: team.total_points,
          team_status: team.status || 1,
          match_id: team.match?._id,
          user_id: team.user?._id,
          user_name: team.user?.name,
          user_email: team.user?.email,
          match_start_time: team.match?.start_time,
          team1_short_name,
          team2_short_name,
          players: formattedPlayers,
        }
      );
    } catch (error) {
      console.error("getFantasyTeamById error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = teamManagerController;
