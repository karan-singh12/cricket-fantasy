const { setLanguage } = require("../utils/responseMsg");
const Language = require("../models/Language");

const languageMiddleware = async (req, res, next) => {
  try {
    const requestedLangRaw =
      req.body?.language ||
      req.query?.language ||
      req.headers["language"] ||
      "EN";
    const requestedLang = requestedLangRaw.toUpperCase();

    // Use Language Model
    const language = await Language.findOne({ language_type: requestedLang, status: 1 });

    const langToSet = language ? language.language_type : "EN";
    const finalLang = langToSet.toUpperCase() === "HN" ? "HI" : langToSet;

    setLanguage(finalLang);
    next();
  } catch (error) {
    console.error("Error in language middleware:", error);
    setLanguage("EN");
    next();
  }
};

module.exports = languageMiddleware;
