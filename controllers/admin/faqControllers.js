const { knex:db } = require('../../config/database');
const apiResponse = require("../../utils/apiResponse");
const { listing } = require("../../utils/functions");
const { ERROR, FAQ, SUCCESS } = require("../../utils/responseMsg");

const TABLE = 'faq';

const faqController = {
  // Add FAQ
  async addFaq(req, res) {
    try {
      const { title, description, status = 1 } = req.body;

      const [result] = await db(TABLE)
        .insert({
          title,
          description,
          status,
          createdAt: db.fn.now(),
          modifiedAt: db.fn.now(),
        })
        .returning("*");

      return apiResponse.successResponseWithData(res, FAQ.faqAdded, result);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Update FAQ
  async updateFaq(req, res) {
    try {
      const { id, title, description, status } = req.body;

      const [data] = await db(TABLE)
        .where({ id })
        .update({
          title,
          description,
          status,
          modifiedAt: db.fn.now(),
        })
        .returning("*");

      return apiResponse.successResponseWithData(res, FAQ.faqUpdated, data);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get One FAQ
  async getOneFaq(req, res) {
    try {
      const result = await db(TABLE)
        .select("id", "title", "description", "status")
        .where({ id: req.params.id })
        .first();

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, result);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Get All FAQs
  async getAllFaqs(req, res) {
    try {
      const { pageSize = 10, pageNumber = 1, status, searchItem = "" } = req.body;

      const offset = (Math.max(0, pageNumber - 1)) * pageSize;

      const searchQuery = db(TABLE).whereNot("status", 2);

      if (status?.length > 0) {
        searchQuery.andWhere(builder => {
          builder.whereIn("status", status);
        });
      }

      if (searchItem) {
        searchQuery.andWhere("title", "ilike", `%${searchItem}%`);
      }

      const result = await searchQuery
        .select("id", "title", "status", "description", "createdAt")
        .orderBy("createdAt", "desc")
        .limit(pageSize)
        .offset(offset);

      const total = await db(TABLE)
        .whereNot("status", 2)
        .count("id")
        .first();

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords: parseInt(total.count),
        pageNumber,
        pageSize,
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  // Delete FAQ (soft delete)
  async deleteFaq(req, res) {
    try {
      await db(TABLE)
        .where({ id: req.body.id })
        .update({
          status: 2,
          modifiedAt: db.fn.now(),
        });

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

      const [result] = await db(TABLE)
        .where({ id })
        .update({ status, modifiedAt: db.fn.now() })
        .returning("*");

      const msg = status == 1 ? FAQ.faqActivated : FAQ.faqDeactivated;

      return apiResponse.successResponseWithData(res, msg, result);
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  }
};

module.exports = faqController; 