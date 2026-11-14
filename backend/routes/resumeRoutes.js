// routes/resumeRoutes.js
const express = require('express');
const {
  uploadResume,
  getMyResume,
  getMySkills,
  updateMySkills,
  downloadResume,
  deleteResume,
} = require('../controllers/resumeController');
const { protect } = require('../middleware/authMiddleware');
const { applicantOnly } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/upload', protect, applicantOnly, upload.single('resume'), uploadResume);
router.get('/my-resume', protect, applicantOnly, getMyResume);
router.get('/skills', protect, applicantOnly, getMySkills);
router.patch('/skills', protect, applicantOnly, updateMySkills);

// Any authenticated user reaches the controller; it checks ownership or a
// recruiter-applicant relationship before sending the private file.
router.get('/:id/download', protect, downloadResume);

router.delete('/:id', protect, applicantOnly, deleteResume);

module.exports = router;
