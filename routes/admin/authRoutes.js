const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const adminAuthController = require('../../controllers/admin/authController');

// Admin Authentication Routes
router.post('/login', adminAuthController.login);
router.post('/register', adminAuthController.register);
router.post('/logout', adminAuth, adminAuthController.logout);

// Admin Profile Management
router.get('/profile', adminAuth, adminAuthController.getProfile);
router.put("/change-password",adminAuth,adminAuthController.changePassword)
router.put('/profile', adminAuth, adminAuthController.updateProfile);
router.post('/updatesocial', adminAuth, adminAuthController.updateSocialLinks);
router.get('/getsocials', adminAuth, adminAuthController.getSocialLinks);
router.post('/reset-password', adminAuthController.forgotpassword);

module.exports = router; 