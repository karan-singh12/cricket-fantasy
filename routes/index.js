const express = require('express');
const router = express.Router();

// Import route modules
const adminRoutes = require('./admin');
const userRoutes = require('./user');

// Mount routes
router.use('/admin', adminRoutes);
router.use('/user', userRoutes);

// Health check route
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
router.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

module.exports = router; 