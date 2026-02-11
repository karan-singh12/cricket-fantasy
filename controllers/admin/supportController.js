const Support = require('../../models/Support');
const User = require('../../models/User');
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, SUPPORT } = require("../../utils/responseMsg");

const supportController = {
  // Get all support queries with pagination and search
  async getAllQueries(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",
        sortBy = "created_at",
        sortOrder = "desc",
        status = [],
        type,
      } = req.body;

      const limit = parseInt(pageSize) || 10;
      const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

      const filter = {};

      if (status.length > 0) {
        filter.status = { $in: status.map(Number) };
      }

      if (type) {
        filter.type = type;
      }

      if (searchItem) {
        // Search in Support fields and optionally User fields
        filter.$or = [
          { type: { $regex: searchItem, $options: "i" } },
          { message: { $regex: searchItem, $options: "i" } },
          { response: { $regex: searchItem, $options: "i" } },
          { name: { $regex: searchItem, $options: "i" } },
          { email: { $regex: searchItem, $options: "i" } }
        ];
      }

      const totalRecords = await Support.countDocuments(filter);
      const result = await Support.find(filter)
        .populate("user", "name email phone_number")
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const mappedResult = result.map(q => ({
        ...q,
        id: q._id,
        user_phone: q.user?.phone_number || ""
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: mappedResult,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
      });
    } catch (error) {
      console.error('Error getting support queries:', error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get single support query by ID
  async getOneQuery(req, res) {
    try {
      const { id } = req.params;

      const query = await Support.findById(id).populate("user").lean();

      if (!query) {
        return apiResponse.notFoundResponse(res, SUPPORT.queryNotFound);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        ...query,
        id: query._id,
        user_phone: query.user?.phone_number || ""
      });
    } catch (error) {
      console.error('Error getting support query:', error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Resolve support query and send email
  async resolveQuery(req, res) {
    try {
      const { id, responseMessage } = req.body;

      if (!id) {
        return apiResponse.ErrorResponse(res, "id is required")
      }

      const supportQuery = await Support.findById(id).populate("user").lean();

      if (!supportQuery) {
        return apiResponse.notFoundResponse(res, SUPPORT.queryNotFound);
      }

      const updatedQuery = await Support.findByIdAndUpdate(id, {
        status: 2,
        response: responseMessage,
      }, { new: true }).lean();

      return apiResponse.successResponseWithData(res, SUPPORT.queryResolved, {
        ...updatedQuery,
        id: updatedQuery._id
      });
    } catch (error) {
      console.error('Error resolving support query:', error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = supportController;