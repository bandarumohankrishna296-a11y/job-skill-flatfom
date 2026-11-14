// routes/applicantRoutes.js
const express = require('express');
const { getApplicantDashboard } = require('../controllers/applicantController');
const { protect } = require('../middleware/authMiddleware');
const { applicantOnly } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/dashboard', protect, applicantOnly, getApplicantDashboard);

module.exports = router;
