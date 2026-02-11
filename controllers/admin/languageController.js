const Language = require("../../models/Language");
const apiResponse = require("../../utils/apiResponse");
const { ERROR, SUCCESS, LANGUAGE } = require("../../utils/responseMsg");

const languageController = {
  async Addlanguage(req, res) {
    try {
      const { language_type, name, status = 1 } = req.body;

      if (!language_type || !name) {
        return apiResponse.validationErrorWithData(res, LANGUAGE.languageTypeAndNameRequired);
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

      const existingLanguage = await Language.findOne({ language_type: capitalized_language_type });

      if (existingLanguage) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageAlreadyExists);
      }

      const newLanguage = await Language.create({
        language_type: capitalized_language_type,
        name,
        status,
      });

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languageAdded,
        { ...newLanguage.toObject(), id: newLanguage._id }
      );
    } catch (error) {
      console.error("Error adding language:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async Getalllanguage(req, res) {
    try {
      const { limit = 10, page = 1, search = "" } = req.body;
      const pageSize = parseInt(limit) || 10;
      const skip = (Math.max(1, parseInt(page)) - 1) * pageSize;

      const filter = {};
      if (search.trim() !== "") {
        filter.$or = [
          { language_type: { $regex: search.trim(), $options: "i" } },
          { name: { $regex: search.trim(), $options: "i" } }
        ];
      }

      const totalRecords = await Language.countDocuments(filter);
      const languages = await Language.find(filter)
        .sort({ created_at: -1 })
        .skip(search.trim() !== "" ? 0 : skip) // Original logic skipped pagination on search
        .limit(search.trim() !== "" ? undefined : pageSize)
        .lean();

      const mappedData = languages.map(lang => ({
        ...lang,
        id: lang._id
      }));

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languagesFetchedSuccessfully,
        {
          data: mappedData,
          current_page: search.trim() !== "" ? 1 : parseInt(page),
          total_pages: search.trim() !== "" ? 1 : Math.ceil(totalRecords / pageSize),
          total_records: totalRecords,
          limit: search.trim() !== "" ? totalRecords : pageSize,
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

      const language = await Language.findById(id).lean();

      if (!language) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languageFetchedSuccessfully,
        { ...language, id: language._id }
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

      if (!language_type || !name) {
        return apiResponse.validationErrorWithData(
          res,
          LANGUAGE.languageTypeAndNameRequired
        );
      }

      const duplicateLanguage = await Language.findOne({
        language_type: language_type.toUpperCase(),
        _id: { $ne: id }
      });

      if (duplicateLanguage) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageTypeAlreadyExists);
      }

      const updated = await Language.findByIdAndUpdate(id, {
        language_type: language_type.toUpperCase(),
        name,
      }, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageNotFound);
      }

      return apiResponse.successResponseWithData(
        res,
        LANGUAGE.languageUpdatedSuccessfully,
        { ...updated, id: updated._id }
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
      const language = await Language.findById(id);
      if (!language) {
        return apiResponse.ErrorResponse(res, LANGUAGE.languageNotFound);
      }

      language.status = language.status === 1 ? 0 : 1;
      await language.save();

      return apiResponse.successResponseWithData(
        res,
        `Language status toggled to ${language.status === 1 ? "active" : "inactive"}`,
        { ...language.toObject(), id: language._id }
      );
    } catch (error) {
      console.error("Error toggling language status:", error.message);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = languageController;
