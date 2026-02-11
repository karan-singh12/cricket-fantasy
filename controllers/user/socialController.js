const { knex } = require("../../config/database");
const {
  ERROR,

  SUCCESS,
} = require("../../utils/responseMsg");
const apiResponse = require("../../utils/apiResponse");

const socialController = {
  async getSocials(req, res) {
    try {
      const data = await knex("social_links").first();

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = socialController;
