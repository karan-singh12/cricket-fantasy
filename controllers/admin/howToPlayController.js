const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");

const TABLE = "how_to_play";

const howToPlayController = {
  async add(req, res) {
    try {
      const { tab, data } = req.body;
      const sections = data?.sections;
     

      if (!tab || !Array.isArray(sections)) {
        return apiResponse.validationErrorWithData(
          res,
          "Tab and sections both are required"
        );
      }

      const exists = await db(TABLE).where({ tab }).first();
      if (exists) {
        return apiResponse.ErrorResponse(res, "Tab already exists");
      }

      let bannerImagePath = null;
      if (req.file) {
        bannerImagePath = req.file.path.replace(/\\/g, "/");
      }

    

      const [result] = await db(TABLE)
        .insert({
          tab,
          data: JSON.stringify({ sections }),
          banner_image: bannerImagePath,
        })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        "Tab added successfully",
        result
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to add How to Play data");
    }
  },

  async list(req, res) {
    try {
      const { pageNumber = 1, pageSize = 10, search = "" } = req.body;
      const offset = (pageNumber - 1) * pageSize;

      const queryBuilder = db(TABLE);

      if (search) {
        queryBuilder.whereILike("tab", `%${search}%`);
      }

      const totalRecordsResult = await queryBuilder
        .clone()
        .count("id as count")
        .first();
      const totalRecords = Number(totalRecordsResult?.count) || 0;

      const result = await queryBuilder
        .clone()
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset(offset);

      return apiResponse.successResponseWithData(
        res,
        "Tabs fetched successfully",
        {
          result,
          totalRecords,
          pageNumber: Number(pageNumber),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(totalRecords / pageSize),
        }
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to fetch How to Play data");
    }
  },

  async getOne(req, res) {
    try {
      const { id } = req.params;

      const row = await db(TABLE).where({ id }).first();
      if (!row) {
        return apiResponse.ErrorResponse(res, "Tab not found");
      }

      return apiResponse.successResponseWithData(res, "Tab fetched", row);
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Error fetching tab");
    }
  },

  async update(req, res) {
    try {
      const { id, tab, sections } = req.body;

      const updatedData = {
        updated_at: db.fn.now(),
      };

      if (tab) updatedData.tab = tab;
      if (sections) updatedData.data = JSON.stringify({ sections });

      if (req.file) {
        updatedData.banner_image = req.file.path.replace(/\\/g, "/");
      }

      const [updated] = await db(TABLE)
        .where({ id })
        .update(updatedData)
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, "Update failed");
      }

      return apiResponse.successResponseWithData(res, "Tab updated", updated);
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(
        res,
        "Failed to update How to Play data"
      );
    }
  },

  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (![true, false].includes(status)) {
        return apiResponse.ErrorResponse(res, "Invalid status");
      }

      const [updated] = await db(TABLE)
        .where({ id })
        .update({ status })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(res, "Status change failed");
      }

      return apiResponse.successResponseWithData(
        res,
        "Status updated",
        updated
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to update status");
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      const deleted = await db(TABLE).where({ id }).del();

      if (!deleted) {
        return apiResponse.ErrorResponse(
          res,
          "Tab not found or already deleted"
        );
      }

      return apiResponse.successResponse(res, "Tab deleted successfully");
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to delete tab");
    }
  },
};

module.exports = howToPlayController;
