const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const fxn = require('../../controllers/admin/supportController');

router.post('/getAllQuery', adminAuth, fxn.getAllQueries);

router.get('/getOneQuery/:id', adminAuth, fxn.getOneQuery);

router.post('/resolveQuery', adminAuth, fxn.resolveQuery);

module.exports = router;
