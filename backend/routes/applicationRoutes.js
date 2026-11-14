// routes/applicationRoutes.js
const express = require('express');
const {
  applyForJob,
  getMyApplications,
  getApplicantDashboard,
  getJobApplications,
  updateApplicationStatus,
} = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');
const { applicantOnly, recruiterOnly } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/dashboard', protect, applicantOnly, getApplicantDashboard);
router.get('/my-applications', protect, applicantOnly, getMyApplications);
router.post('/apply/:jobId', protect, applicantOnly, applyForJob);

router.get('/job/:jobId', protect, recruiterOnly, getJobApplications);
router.patch('/:id/status', protect, recruiterOnly, updateApplicationStatus);

module.exports = router;
