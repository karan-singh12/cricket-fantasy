const express = require('express');
const router = express.Router();
const fantasyPointsController = require('../../controllers/admin/fantasyPointsController');
const adminAuth = require('../../middleware/adminAuth');

// CRUD operations
router.post('/create',adminAuth, fantasyPointsController.createFantasyPoint);
router.post('/getAll',adminAuth, fantasyPointsController.getAllFantasyPoints);
router.get('/:id',adminAuth, fantasyPointsController.getOneFantasyPoint);
router.post('/update',adminAuth, fantasyPointsController.updateFantasyPoint);
router.post('/',adminAuth, fantasyPointsController.deleteFantasyPoint);

// Additional endpoints
router.get('/player-match', fantasyPointsController.getFantasyPointsByPlayerAndMatch);
router.get('/match', fantasyPointsController.getFantasyPointsByMatch);

module.exports = router;