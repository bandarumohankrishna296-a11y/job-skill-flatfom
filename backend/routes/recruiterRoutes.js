// routes/recruiterRoutes.js
const express = require('express');
const {
  getRecruiterDashboard,
  searchCandidates,
  getCandidateDetails,
  getRecruiterJobs,
  getRecruiterApplications,
} = require('../controllers/recruiterController');
const { protect } = require('../middleware/authMiddleware');
const { recruiterOnly } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, recruiterOnly);

router.get('/dashboard', getRecruiterDashboard);
router.get('/candidates', searchCandidates);
router.get('/candidates/:applicantId', getCandidateDetails);
router.get('/jobs', getRecruiterJobs);
router.get('/applications', getRecruiterApplications);

module.exports = router;
