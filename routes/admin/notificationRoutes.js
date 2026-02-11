const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const notificationController = require('../../controllers/admin/notificationController');

// Apply admin auth middleware to all routes
router.use(adminAuth);

/**
 * @route   POST /api/v1/admin/notifications/send
 * @desc    Send notification to users using a template
 * @access  Private/Admin
 */
router.post('/send', notificationController.sendNotification);

/**
 * @route   GET /api/v1/admin/notifications
 * @desc    Get all notifications with pagination and search
 * @access  Private/Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @query   search - Search term for notification title/content
 */
// router.get('/', notificationController.getAllNotifications);

// /**
//  * @route   GET /api/v1/admin/notifications/:id
//  * @desc    Get notification details with recipients list
//  * @access  Private/Admin
//  * @param   id - Notification ID
//  */
// router.get('/:id', notificationController.getNotificationDetails);

module.exports = router;
