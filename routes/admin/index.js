const express = require('express');
const router = express.Router();

// Import admin route modules
const authRoutes = require('./authRoutes');
const playerRoutes = require('./playerRoutes');
const contestRoutes = require('./contestRoutes');
const matchRoutes = require('./matchRoutes');
const tournamentRoutes = require('./tournamentRoutes');
const cmsRoutes = require('./cmsRoutes');
const emailTemplateRoutes = require('./emailTemplateRoutes');
const usersRoutes = require('./users');
const faqRoutes = require('./faqRoutes');
const subadminRoutes = require('./subadminRoutes');
const bannerRoutes = require('./bannerRoutes');
const supportRoutes = require('./supportRoutes');
const notificationRoutes = require('./notificationRoutes');
const notificationTemplateRoutes = require('./notificationTemplate');
const language = require("./languageRoutes")
const howtoplay = require("./howToPlayRoutes")
const fantasy_points = require("./fantasyPoints")
const teamManagerRoutes = require("./teamManagerRoutes")
const sportmonksRoutes = require('./sportmonksRoutes');
const paymentManagementRoutes = require('./paymentManagementRoutes');
const referralRoutes = require('./referralRoutes');
const appdownloadRoutes = require("./appdownloadRoutes")
const ssRoutes = require("./screenshots")
const botRoutes = require('./botRoutes');


// Mount admin routes
router.use('/auth', authRoutes);
router.use('/players', playerRoutes);
router.use('/contests', contestRoutes);
router.use('/matches', matchRoutes);
router.use('/tournaments', tournamentRoutes);
router.use('/cms', cmsRoutes);
router.use('/emailTemplate', emailTemplateRoutes);
router.use('/faq', faqRoutes);
router.use('/user', usersRoutes);
router.use('/subadmin', subadminRoutes);
router.use('/banner', bannerRoutes);
router.use('/support', supportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/notificationTemplates', notificationTemplateRoutes);
router.use('/language', language);
router.use("/howtoplay",howtoplay)
router.use("/fantasypoints",fantasy_points)
router.use("/teamManager",teamManagerRoutes)
router.use('/sportmonks', sportmonksRoutes);
router.use('/payment-management', paymentManagementRoutes);
router.use('/referralprogram', referralRoutes);
router.use("/app",appdownloadRoutes)
router.use('/bot', botRoutes);

router.use("/ssRoutes",ssRoutes)
module.exports = router; 