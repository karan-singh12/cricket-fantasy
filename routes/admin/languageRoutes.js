const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/adminAuth");
const fxn = require("../../controllers/admin/languageController");

// Routes for language
router.post("/Addlanguage", adminAuth, fxn.Addlanguage);
router.post("/Getalllanguage", adminAuth, fxn.Getalllanguage);
router.get("/Getalllanguagebyid/:id", adminAuth, fxn.GetlanguageById);
router.post("/Updatelanguage/:id", adminAuth, fxn.Updatelanguage);
router.post("/ToggleLanguageStatus", adminAuth, fxn.ToggleLanguageStatus);

module.exports = router;
