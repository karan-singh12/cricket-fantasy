const FAQModel = require('../../models/Faq');
const apiResponse = require("../../utils/apiResponse");
const { ERROR, FAQ, SUCCESS } = require("../../utils/responseMsg");

const faqController = {
  // Add FAQ
  async addFaq(req, res) {
    try {
      const { title, description, status = 1 } = req.body;

      const result = await FAQModel.create({
        title,
        description,
        status,
      });

      return apiResponse.successResponseWithData(res, FAQ.faqAdded, {
        ...result.toObject(),
        id: result._id
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Update FAQ
  async updateFaq(req, res) {
    try {
      const { id, title, description, status } = req.body;

      const data = await FAQModel.findByIdAndUpdate(id, {
        title,
        description,
        status,
      }, { new: true }).lean();

      if (!data) {
        return apiResponse.ErrorResponse(res, FAQ.faqNotFound);
      }

      return apiResponse.successResponseWithData(res, FAQ.faqUpdated, {
        ...data,
        id: data._id
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get One FAQ
  async getOneFaq(req, res) {
    try {
      const result = await FAQModel.findById(req.params.id)
        .select("title description status")
        .lean();

      if (!result) {
        return apiResponse.ErrorResponse(res, FAQ.faqNotFound);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        ...result,
        id: result._id
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get All FAQs
  async getAllFaqs(req, res) {
    try {
      const { pageSize = 10, pageNumber = 1, status = [], searchItem = "" } = req.body;

      const limit = parseInt(pageSize) || 10;
      const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

      const filter = { status: { $ne: 2 } };

      if (status.length > 0) {
        filter.status = { $in: status.map(Number) };
      }

      if (searchItem) {
        filter.title = { $regex: searchItem, $options: "i" };
      }

      const totalRecords = await FAQModel.countDocuments(filter);
      const result = await FAQModel.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const mappedResult = result.map(faq => ({
        ...faq,
        id: faq._id,
        createdAt: faq.created_at
      }));

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result: mappedResult,
        totalRecords,
        pageNumber: parseInt(pageNumber),
        pageSize: limit,
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Delete FAQ (soft delete)
  async deleteFaq(req, res) {
    try {
      const { id } = req.body;
      const updated = await FAQModel.findByIdAndUpdate(id, {
        status: 2,
      }, { new: true });

      if (!updated) {
        return apiResponse.ErrorResponse(res, FAQ.faqNotFound);
      }

      return apiResponse.successResponse(res, FAQ.faqDeleted);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Change Status (active/inactive)
  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (![0, 1].includes(status)) {
        return apiResponse.ErrorResponse(res, 'Invalid status value');
      }

      const result = await FAQModel.findByIdAndUpdate(id, { status }, { new: true }).lean();

      if (!result) {
        return apiResponse.ErrorResponse(res, FAQ.faqNotFound);
      }

      const msg = status == 1 ? FAQ.faqActivated : FAQ.faqDeactivated;

      return apiResponse.successResponseWithData(res, msg, {
        ...result,
        id: result._id
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = faqController;