// routes/jobRoutes.js
const express = require('express');
const {
  getJobs,
  getJobMatches,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
} = require('../controllers/jobController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { applicantOnly, recruiterOnly } = require('../middleware/roleMiddleware');

const router = express.Router();

// Static route must be declared before "/:id".
router.get('/matches', protect, applicantOnly, getJobMatches);

router.get('/', optionalAuth, getJobs);
router.get('/:id', optionalAuth, getJobById);

router.post('/', protect, recruiterOnly, createJob);
router.put('/:id', protect, recruiterOnly, updateJob);
router.delete('/:id', protect, recruiterOnly, deleteJob);

module.exports = router;
