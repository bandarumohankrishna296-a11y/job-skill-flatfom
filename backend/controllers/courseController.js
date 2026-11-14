// controllers/courseController.js
const Course = require('../models/Course');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const { calculateMatch } = require('../utils/matchCalculator');
const { buildRecommendations } = require('../utils/courseRecommender');
const { normalizeSkills } = require('../utils/skillExtractor');
const { escapeRegex, isValidObjectId, parsePagination, buildPagination } = require('../utils/validators');

// GET /api/courses?skill=Python&q=react&page=1&limit=12
async function getCourses(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const skill = typeof req.query.skill === 'string' ? req.query.skill.trim().slice(0, 50) : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';

    if (skill) filter.skill = new RegExp(`^${escapeRegex(skill)}$`, 'i');
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: regex }, { platform: regex }, { skill: regex }, { description: regex }];
    }

    const [courses, total] = await Promise.all([
      Course.find(filter).sort({ skill: 1, title: 1 }).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: courses,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/courses/recommendations/:jobId (applicant only)
// Finds the skills missing for one job and recommends learning resources.
async function getRecommendationsForJob(req, res, next) {
  try {
    if (!isValidObjectId(req.params.jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await Job.findById(req.params.jobId).lean();
    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const resume = await Resume.findOne({ applicant: req.user._id }).lean();
    const match = calculateMatch(resume ? resume.skills : [], job.requiredSkills);
    const dbCourses = await Course.find({
      skill: { $in: match.missingSkills },
    }).lean();
    const recommendations = buildRecommendations(match.missingSkills, dbCourses);

    return res.status(200).json({
      success: true,
      job: {
        id: job._id,
        title: job.title,
        company: job.company,
        requiredSkills: job.requiredSkills,
      },
      match: {
        matchPercentage: match.matchPercentage,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        matchedCount: match.matchedCount,
        totalRequired: match.totalRequired,
      },
      recommendations,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/courses/recommendations?skills=Python,React
// Useful when an applicant manually selects skills they want to learn.
async function getRecommendationsForSkills(req, res, next) {
  try {
    const skills = normalizeSkills(
      typeof req.query.skills === 'string' ? req.query.skills.split(',') : []
    ).slice(0, 12);

    const dbCourses = skills.length > 0
      ? await Course.find({ skill: { $in: skills } }).lean()
      : [];
    const recommendations = buildRecommendations(skills, dbCourses);

    return res.status(200).json({
      success: true,
      recommendations,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCourses,
  getRecommendationsForJob,
  getRecommendationsForSkills,
};
