const express = require('express');
const router = express.Router();

// Placeholder route
router.get('/', (req, res) => {
    res.json({ message: 'Team routes placeholder' });
});

module.exports = router; 