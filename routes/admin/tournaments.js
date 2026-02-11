const express = require('express');
const router = express.Router();
const tournamentsController = require('../controllers/tournamentsController');
const { auth } = require('../middleware/auth');

// Public routes
router.get('/', tournamentsController.getAllTournaments);

// Protected routes (require authentication)
router.post('/sync', auth, tournamentsController.syncTournaments);

module.exports = router; 