const path = require("path");
const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const {
  slugGenrator,
  listing,
  deleteFileIfExists,
} = require("../../utils/functions");
const { ERROR, CONTENT, SUCCESS, EMAILTEMPLATE, USER } = require("../../utils/responseMsg");

const TABLE = "cms";

const contentController = {
  async addContent(req, res) {
    try {
      const { title, description, contentType, status = 1 } = req.body;

      const existingContent = await db(TABLE).where({ contentType }).first();

      if (existingContent) {
        return apiResponse.ErrorResponse(
          res,
         CONTENT.contentWithThisTypeAlreadyExists
        );
      }

      let imagePath = null;

      if (req.file) {
        imagePath = req.file.path.replace(/\\/g, "/");
      }

      const slug = await slugGenrator(contentType);

      const [result] = await db(TABLE)
        .insert({
          title,
          description,
          contentType: contentType,
          slug,
          status,
          image_path: imagePath,
          createdAt: db.fn.now(),
          modifiedAt: db.fn.now(),
        })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        CONTENT.contentAdded,
        result
      );
    } catch (error) {
      console.error(error);

      if (req.file && req.file.path) {
        deleteFileIfExists(req.file.path);
      }
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAllContent(req, res) {
    try {
      let {
        pageSize = 10,
        pageNumber = 1,
        searchItem = "",

        status = [],
      } = req.body;

      pageNumber = Math.max(0, pageNumber - 1);

      let query = db(TABLE).whereNot("status", 2);

      if (status.length > 0) {
        query.andWhere((qb) => qb.whereIn("status", status));
      }

      if (searchItem) {
        query.andWhere((builder) =>
          builder
            .whereILike("title", `%${searchItem}%`)
            .orWhereILike("description", `%${searchItem}%`)
        );
      }

      const totalRecordsData = await query.clone().count("id").first();

      const result = await query
        .select(
          "id",
          "title",
          "contentType",
          "slug",
          "createdAt",
          "status",
          "description"
        )

        .limit(pageSize)
        .offset(pageNumber * pageSize);

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        result,
        totalRecords: parseInt(totalRecordsData.count),
        pageNumber: pageNumber + 1,
        pageSize,
      });
    } catch (error) {
      console.error(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getOneContent(req, res) {
    try {
      const result = await db(TABLE)
        .select("id", "title", "description", "slug")
        .where({ id: req.params.id })
        .first();

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        result
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateContent(req, res) {
    try {
      const { id, title, description, status } = req.body;

      let imagePath = null;

      if (req.file) {
        imagePath = req.file.path.replace(/\\/g, "/");
      }

      const oldRecord = await db(TABLE)
        .select("image_path")
        .where({ id })
        .first();

      const [data] = await db(TABLE)
        .where({ id })
        .update({
          title,
          description,
          image_path: imagePath || oldRecord.image_path,
          status,
          modifiedAt: db.fn.now(),
        })
        .returning("*");

      if (imagePath && oldRecord && oldRecord.image_path) {
        deleteFileIfExists(path.join(process.cwd(), oldRecord.image_path));
      }

      let msg = CONTENT.updateContent;

      switch (data.slug) {
        case process.env.PRIVACY_POLICY:
          msg = CONTENT.privacyUpdated;
          break;
        case process.env.TERMS:
          msg = CONTENT.termsUpdated;
          break;
        case process.env.ABOUT_US:
          msg = CONTENT.aboutUpdated;
          break;
        case process.env.APP_WELCOME_SCREEN:
          msg = CONTENT.welcomeUpdated;
          break;
        case process.env.COMMUNITY_GUIDELINES:
          msg = CONTENT.communityGuidelinesUpdated;
          break;
      }

      return apiResponse.successResponseWithData(res, msg, data);
    } catch (error) {
      console.log(error.message);

      if (req.file && req.file.path) {
        deleteFileIfExists(req.file.path);
      }
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.body;
      const { status } = req.body;

      if (![0, 1].includes(status)) {
        return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
      }

      const [updated] = await db(TABLE)
        .where({ id })
        .update({ status, modifiedAt: db.fn.now() })
        .returning("*");

      if (!updated) {
        return apiResponse.ErrorResponse(
          res,
          EMAILTEMPLATE.templateNotFoundOrNotUpdated
        );
      }

      return apiResponse.successResponseWithData(
        res,
        `Status updated to ${status}`,
        updated
      );
    } catch (error) {
      console.log(error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = contentController;
