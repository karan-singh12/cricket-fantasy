const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const matchController = require('../../controllers/admin/matchController');

// Match Management Routes
router.post('/getAllMatches', adminAuth, matchController.getAllMatches);
router.post('/matches/sync', adminAuth, matchController.syncMatches);
router.put('/matches/:id/visibility', adminAuth, matchController.updateMatchVisibility);
router.put('/matches/:id/status', adminAuth, matchController.updateMatchStatus);
router.delete('/matches/:id', adminAuth, matchController.deleteMatch);

// Match Details Management
// router.put('/matches/:id', adminAuth, matchController.updateMatchDetails);
router.post('/matches/:id/result', adminAuth, matchController.updateMatchResult);

module.exports = router; 