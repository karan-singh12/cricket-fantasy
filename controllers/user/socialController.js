const SocialLink = require("../../models/SocialLink");
const { ERROR, SUCCESS } = require("../../utils/responseMsg");
const apiResponse = require("../../utils/apiResponse");

const socialController = {
  async getSocials(req, res) {
    try {
      const data = await SocialLink.findOne().lean();

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, data ? { ...data, id: data._id } : null);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = socialController;
