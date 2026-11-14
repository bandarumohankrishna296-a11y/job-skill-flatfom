// routes/courseRoutes.js
const express = require('express');
const {
  getCourses,
  getRecommendationsForJob,
  getRecommendationsForSkills,
} = require('../controllers/courseController');
const { protect } = require('../middleware/authMiddleware');
const { applicantOnly } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', getCourses);
router.get('/recommendations', protect, getRecommendationsForSkills);
router.get('/recommendations/:jobId', protect, applicantOnly, getRecommendationsForJob);

module.exports = router;
