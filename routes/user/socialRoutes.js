const express = require("express");
const router = express.Router();
const { auth } = require("../../middleware/auth");

const socialController = require("../../controllers/user/socialController");

router.get("/getsocials", socialController.getSocials);

module.exports = router;
