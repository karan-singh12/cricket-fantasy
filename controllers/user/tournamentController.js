const moment = require("moment");
const Tournament = require("../../models/Tournament");
const Match = require("../../models/Match");
const Team = require("../../models/Team");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, TOURNAMENT } = require("../../utils/responseMsg");

const tournamentController = {
  // Get all tournaments
  async getAllTournaments(req, res) {
    try {
      const today = moment().startOf("day").toDate();
      const oneMonthLater = moment().add(1, "months").endOf("day").toDate();

      // Find all active tournaments
      const tournaments = await Tournament.find({ status: { $in: [true, "active", "1"] } })
        .sort({ name: 1 })
        .lean();

      // Filter tournaments that have upcoming matches in the next month
      // Note: Replicating the exact "player_teams" check might be complex here, 
      // focusing on tournaments with valid upcoming matches for now.
      const tournamentIdsWithMatches = await Match.distinct("tournament", {
        status: "NS",
        start_time: { $gte: today, $lte: oneMonthLater }
      });

      const filteredTournaments = tournaments.filter(t =>
        tournamentIdsWithMatches.some(id => id.toString() === t._id.toString())
      );

      // Translation logic (mirroring original)
      const { getLanguage } = require("../../utils/responseMsg");
      const { translateTo } = require("../../utils/google");

      const lang = (getLanguage() || "en").toLowerCase() === "hn" ? "hi" : (getLanguage() || "en").toLowerCase();

      const translatedTournaments = await Promise.all(
        filteredTournaments.map(async (t) => {
          const translatedName = await translateTo(t.name, lang);
          let translatedMetadata = t.metadata || {};

          if (translatedMetadata && typeof translatedMetadata === "object" && translatedMetadata.name) {
            translatedMetadata = {
              ...translatedMetadata,
              name: await translateTo(translatedMetadata.name, lang),
            };
          }

          return {
            ...t,
            id: t._id,
            name: translatedName,
            metadata: translatedMetadata,
          };
        })
      );

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, translatedTournaments);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get tournament by ID
  async getTournamentById(req, res) {
    try {
      const tournament = await Tournament.findOne({ _id: req.params.id, status: { $in: [true, "active", "1"] } }).lean();

      if (!tournament) {
        return apiResponse.ErrorResponse(res, TOURNAMENT.tournamentNotFound);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, { ...tournament, id: tournament._id });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get tournament matches
  async getTournamentMatches(req, res) {
    try {
      const matches = await Match.find({
        tournament: req.params.id,
        status: { $nin: ["Finished", "Aban."] }
      })
        .populate("team1", "name")
        .populate("team2", "name")
        .sort({ start_time: 1 })
        .lean();

      const formattedMatches = matches.map(m => ({
        ...m,
        id: m._id,
        team1_name: m.team1?.name,
        team2_name: m.team2?.name
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, formattedMatches);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = tournamentController;
