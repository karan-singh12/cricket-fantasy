// languageMiddleware.js
const { setLanguage } = require("../utils/responseMsg");
const { knex: db } = require("../config/database");

const languageMiddleware = async (req, res, next) => {
  try {
    const requestedLangRaw =
      req.body?.language ||
      req.query?.language ||
      req.headers["language"] ||
      "EN";
    const requestedLang = requestedLangRaw.toUpperCase();

    const language = await db("language")
      .where("language_type", requestedLang)
      .where("status", 1)
      .first();

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
