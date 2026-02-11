const express = require('express');
const router = express.Router();
const cricketController = require('../controllers/cricketController');

router.get('/matches', cricketController.getMatches);

module.exports = router;