const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, LANGUAGE } = require("../../utils/responseMsg");

const languageController = {
  async Addlanguage(req, res) {
    try {
      const { language_type, name, status } = req.body;

      if (!language_type || !name) {
        return apiResponse.validationErrorWithData( res, LANGUAGE.languageTypeAndNameRequired );
      }
      const alphaRegex = /^[A-Za-z]+$/;

      if (!alphaRegex.test(language_type)) {
        return apiResponse.validationErrorWithData(
          res,
          "language_type must contain only letters (no spaces, numbers, or special characters)"
        );
      }
  
      if (!alphaRegex.test(name)) {
        return apiResponse.validationErrorWithData(
          res,
          "name must contain only letters (no spaces, numbers, or special characters)"
        );
      }

      if (language_type.length > 6) {
        return apiResponse.validationErrorWithData(
          res,
          LANGUAGE.languageTypeMaxLength
        );
      }
  
      if (name.length > 12) {
        return apiResponse.validationErrorWithData(
          res,
          LANGUAGE.languageNameMaxLength
        );
      }

      const capitalized_language_type = language_type.toUpperCase();

      const existingLanguage = await db("language")
        .where("language_type", capitalized_language_type)
        .first();

      if (existingLanguage) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageAlreadyExists);
      }

      const [newLanguage] = await db("language")
        .insert({
          language_type:capitalized_language_type,
          name,
          status: status ?? 1,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languageAdded,
        newLanguage
      );
    } catch (error) {
      console.error("Error adding language:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async Getalllanguage(req, res) {
    try {
      const { limit = 10, page = 1, search = "" } = req.body;
      const offset = (Math.max(0, page - 1)) * limit;
  
      let query = db("language")
  
      // If search keyword is provided
      if (search.trim() !== "") {
        query = query.where(function () {
          this.where("language_type", "ilike", `%${search.trim()}%`)
            .orWhere("name", "ilike", `%${search.trim()}%`);
        });
  
        // Ignore pagination when search is used
        const languages = await query
          .select("*")
          .orderBy("created_at", "desc");
  
        return apiResponse.successResponseWithData(
          res,
          LANGUAGE.languagesFetchedSuccessfully,
          {
            data: languages,
            current_page: 1,
            total_pages: 1,
            total_records: languages.length,
            limit: languages.length,
          }
        );
      }
  
      // When no search, apply pagination
      const totalCount = await query.clone().count("* as count").first();
  
      const languages = await query
        .select("*")
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);
  
      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languagesFetchedSuccessfully,
        {
          data: languages,
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount.count / limit),
          total_records: Number(totalCount.count),
          limit: parseInt(limit),
        }
      );
    } catch (error) {
      console.error("Error fetching languages:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  

  async GetlanguageById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return apiResponse.validationErrorWithData(
          res,
          "Language ID is required"
        );
      }

      const language = await db("language").where("id", id).first();

      if (!language) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languageFetchedSuccessfully,
        language
      );
    } catch (error) {
      console.error("Error fetching language:", error);
      return apiResponse.ErrorResponse(
        res,
        error.message || ERROR.somethingWrong
      );
    }
  },

  async Updatelanguage(req, res) {
    try {
      const { id } = req.params;
      const { language_type, name } = req.body;

   

      if (!id) {
        return apiResponse.validationErrorWithData(
          res,
          LANGUAGE.languageIDRequired
        );
      }

      if (!language_type || !name) {
        return apiResponse.validationErrorWithData(
          res,
          LANGUAGE.languageTypeAndNameRequired
        );
      }

      const existingLanguage = await db("language").where("id", id).first();
      if (!existingLanguage) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageNotFound);
      }

      const duplicateLanguage = await db("language")
        .where("language_type", language_type)
        .whereNot("id", id)
        .first();

      if (duplicateLanguage) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageTypeAlreadyExists);
      }

      const [updatedLanguage] = await db("language")
        .where("id", id)
        .update({
          language_type,
          name,
          updated_at: db.fn.now(),
        })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languageUpdatedSuccessfully,
        updatedLanguage
      );
    } catch (error) {
      console.error("Error updating language:", error);
      return apiResponse.ErrorResponse(
        res,
        error.message || ERROR.somethingWrong
      );
    }
  },

  async ToggleLanguageStatus(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return apiResponse.validationErrorWithData(
          res,
          "Language ID is required"
        );
      }
      const language = await db("language").where("id", id).first();
      if (!language) {
        return apiResponse.ErrorResponse(res,LANGUAGE.languageNotFound);
      }
      const newStatus = language.status === 1 ? 0 : 1;
      const [updatedLanguage] = await db("language")
        .where("id", id)
        .update({
          status: newStatus,
          updated_at: db.fn.now(),
        })
        .returning("*");
      return apiResponse.successResponseWithData(
        res,
        `Language status toggled to ${newStatus === 1 ? "active" : "inactive"}`,
        updatedLanguage
      );
    } catch (error) {
      console.error("Error toggling language status:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = languageController;
