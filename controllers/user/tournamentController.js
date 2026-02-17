const moment = require("moment");
const { knex } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, TOURNAMENT } = require("../../utils/responseMsg");

const tournamentController = {
  // Get all tournaments
  async getAllTournaments(req, res) {

    try {
      const today = moment().startOf("day").toDate();
      const oneMonthLater = moment().add(1, "months").endOf("day").toDate();
      // const next7Days = moment().add(7, "days").endOf("day").toDate();

      let tournaments = await knex("tournaments as t")
        .select("t.*")
        .where("t.status", 1)
        .whereExists(function () {
          this.select("*")
            .from("matches as m")
            .leftJoin("teams as t1", "m.team1_id", "t1.id")
            .leftJoin("teams as t2", "m.team2_id", "t2.id")
            .whereRaw("m.tournament_id = t.id")
            .whereBetween("m.start_time", [today, oneMonthLater])
            .where("m.status", "NS")
            .whereNotNull("t1.id")
            .whereNotNull("t2.id")
            .whereExists(function () {
              this.select("*")
                .from("player_teams")
                .whereRaw("player_teams.team_id = m.team1_id")
                .whereRaw("player_teams.season_id::text = t.season");
            })
            .whereExists(function () {
              this.select("*")
                .from("player_teams")
                .whereRaw("player_teams.team_id = m.team2_id")
                .whereRaw("player_teams.season_id::text = t.season");
            });
        })
        .orderBy("t.name", "asc");

      // Fallback: If no tournaments with upcoming matches and squad are found, 
      // return all active tournaments as "simple tournaments"
      if (!tournaments.length) {
        tournaments = await knex("tournaments")
          .where("status", 1)
          .orderBy("name", "asc");
      }




      const { getLanguage } = require("../../utils/responseMsg");
      const { translateTo } = require("../../utils/google");

      const lang =
        getLanguage().toLowerCase() === "hn"
          ? "hi"
          : getLanguage().toLowerCase();


      const translatedTournaments = await Promise.all(
        tournaments.map(async (t) => {
          const translatedName = await translateTo(t.name, lang);
          let translatedMetadata = t.metadata;

          if (
            translatedMetadata &&
            typeof translatedMetadata === "object" &&
            translatedMetadata.name
          ) {
            translatedMetadata = {
              ...translatedMetadata,
              name: await translateTo(translatedMetadata.name, lang),
            };
          }

          return {
            ...t,
            name: translatedName,
            metadata: translatedMetadata,
          };
        })
      );

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        translatedTournaments
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get tournament by ID
  async getTournamentById(req, res) {
    try {
      const tournament = await knex("tournaments")
        .where("id", req.params.id)
        .where("status", 1)
        .first();

      if (!tournament) {
        return apiResponse.ErrorResponse(res, TOURNAMENT.tournamentNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        tournament
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get tournament matches
  async getTournamentMatches(req, res) {
    try {
      const matches = await knex("matches")
        .select(
          "matches.*",
          "t1.name as team1_name",
          "t2.name as team2_name"
          // 'venues.name as venue_name'
        )
        .leftJoin("teams as t1", "matches.team1_id", "t1.id")
        .leftJoin("teams as t2", "matches.team2_id", "t2.id")
        // .leftJoin('venues', 'matches.venue_id', 'venues.id')
        .where("matches.tournament_id", req.params.id)
        .orderBy("matches.start_time", "asc")
        .whereNot("matches.status", "Finished")
        .whereNot("matches.status", "Aban.")

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        matches
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = tournamentController;