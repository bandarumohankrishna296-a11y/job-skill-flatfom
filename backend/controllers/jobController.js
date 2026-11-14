// controllers/jobController.js
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const { calculateMatch } = require('../utils/matchCalculator');
const { normalizeSkills } = require('../utils/skillExtractor');
const {
  cleanText,
  isValidObjectId,
  escapeRegex,
  parsePagination,
  buildPagination,
} = require('../utils/validators');

const { JOB_TYPES, EXPERIENCE_LEVELS, JOB_CATEGORIES } = Job;

function buildJobFilter(query) {
  const filter = { isActive: true };

  const q = cleanText(query.q, 100);
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { title: regex },
      { company: regex },
      { description: regex },
      { category: regex },
      { requiredSkills: regex },
    ];
  }

  const location = cleanText(query.location, 80);
  if (location) filter.location = new RegExp(escapeRegex(location), 'i');

  if (JOB_TYPES.includes(query.jobType)) filter.jobType = query.jobType;
  if (EXPERIENCE_LEVELS.includes(query.experienceLevel)) filter.experienceLevel = query.experienceLevel;
  if (JOB_CATEGORIES.includes(query.category)) filter.category = query.category;

  if (typeof query.skills === 'string' && query.skills.trim()) {
    const skills = normalizeSkills(query.skills.split(','));
    if (skills.length > 0) filter.requiredSkills = { $in: skills };
  }

  return filter;
}

function getSortOption(sort) {
  if (sort === 'oldest') return { createdAt: 1 };
  if (sort === 'title') return { title: 1 };
  return { createdAt: -1 };
}

async function getApplicantContext(userId) {
  if (!userId) return { skills: [], hasResume: false };
  const resume = await Resume.findOne({ applicant: userId }).lean();
  return {
    skills: resume ? resume.skills : [],
    hasResume: Boolean(resume),
  };
}

// GET /api/jobs
async function getJobs(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildJobFilter(req.query);

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .select('-seedKey -__v')
        .sort(getSortOption(req.query.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
    ]);

    let applicantSkills = [];
    let applicationsByJob = new Map();

    if (req.user && req.user.role === 'applicant') {
      const context = await getApplicantContext(req.user._id);
      applicantSkills = context.skills;

      if (jobs.length > 0) {
        const applications = await Application.find({
          applicant: req.user._id,
          job: { $in: jobs.map((job) => job._id) },
        })
          .select('job status')
          .lean();
        applicationsByJob = new Map(
          applications.map((application) => [application.job.toString(), application.status])
        );
      }
    }

    const data = jobs.map((job) => {
      const match = calculateMatch(applicantSkills, job.requiredSkills);
      return {
        ...job,
        matchPercentage: match.matchPercentage,
        totalRequired: match.totalRequired,
        matchedCount: match.matchedCount,
        hasApplied: applicationsByJob.has(job._id.toString()),
        applicationStatus: applicationsByJob.get(job._id.toString()) || null,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: buildPagination(page, limit, total),
      filters: {
        jobTypes: JOB_TYPES,
        experienceLevels: EXPERIENCE_LEVELS,
        categories: JOB_CATEGORIES,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/jobs/matches  (applicant only)
// Uses a MongoDB aggregation so only one page of jobs is loaded into memory,
// even if the jobs collection is large.
async function getJobMatches(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildJobFilter(req.query);
    const resume = await Resume.findOne({ applicant: req.user._id }).lean();
    const applicantSkills = normalizeSkills(resume ? resume.skills : []);

    const applicantSkillsLower = applicantSkills.map((skill) => skill.toLowerCase());

    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          totalRequired: { $size: { $ifNull: ['$requiredSkills', []] } },
          matchedCount: {
            $size: {
              $setIntersection: [
                {
                  $map: {
                    input: { $ifNull: ['$requiredSkills', []] },
                    as: 'skill',
                    in: { $toLower: '$$skill' },
                  },
                },
                applicantSkillsLower,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          matchPercentage: {
            $cond: [
              { $eq: ['$totalRequired', 0] },
              0,
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$matchedCount', '$totalRequired'] },
                      100,
                    ],
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      { $sort: { matchPercentage: -1, createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }, { $project: { seedKey: 0, __v: 0 } }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Job.aggregate(pipeline);
    const jobs = result.data;
    const total = result.total[0] ? result.total[0].count : 0;

    let applicationsByJob = new Map();
    if (jobs.length > 0) {
      const applications = await Application.find({
        applicant: req.user._id,
        job: { $in: jobs.map((job) => job._id) },
      })
        .select('job status')
        .lean();
      applicationsByJob = new Map(
        applications.map((application) => [application.job.toString(), application.status])
      );
    }

    const data = jobs.map((job) => ({
      ...job,
      hasApplied: applicationsByJob.has(job._id.toString()),
      applicationStatus: applicationsByJob.get(job._id.toString()) || null,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/jobs/:id
async function getJobById(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await Job.findById(req.params.id).populate('recruiter', 'name').lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found.' });
    }

    const isOwner = req.user && req.user.role === 'recruiter'
      && String(job.recruiter._id) === String(req.user._id);

    if (!job.isActive && !isOwner) {
      return res.status(404).json({ success: false, message: 'This job posting is no longer available.' });
    }

    let match = null;
    let application = null;
    let applicantSkills = [];

    if (req.user && req.user.role === 'applicant') {
      const resume = await Resume.findOne({ applicant: req.user._id }).lean();
      applicantSkills = resume ? resume.skills : [];
      match = calculateMatch(applicantSkills, job.requiredSkills);
      application = await Application.findOne({ applicant: req.user._id, job: job._id })
        .select('status matchPercentage appliedAt')
        .lean();
    }

    let applicationCount = null;
    if (isOwner) {
      applicationCount = await Application.countDocuments({ job: job._id });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...job,
        match,
        hasApplied: Boolean(application),
        application,
        isOwner,
        applicationCount,
        applicantSkills,
      },
    });
  } catch (error) {
    return next(error);
  }
}

function validateJobInput(body) {
  const title = cleanText(body.title, 120);
  const company = cleanText(body.company, 120);
  const description = cleanText(body.description, 8000);
  const location = cleanText(body.location, 100);
  const salaryRange = cleanText(body.salaryRange, 80) || 'Not disclosed';
  const jobType = JOB_TYPES.includes(body.jobType) ? body.jobType : 'Full-time';
  const experienceLevel = EXPERIENCE_LEVELS.includes(body.experienceLevel)
    ? body.experienceLevel
    : 'Fresher';
  const category = JOB_CATEGORIES.includes(body.category) ? body.category : 'Other';
  const requiredSkills = normalizeSkills(body.requiredSkills);

  if (title.length < 3) return { error: 'Job title must be at least 3 characters long.' };
  if (company.length < 2) return { error: 'Company name must be at least 2 characters long.' };
  if (description.length < 30) return { error: 'Job description must be at least 30 characters long.' };
  if (location.length < 2) return { error: 'Location is required.' };

  return {
    values: {
      title,
      company,
      description,
      location,
      salaryRange,
      jobType,
      experienceLevel,
      category,
      requiredSkills,
    },
  };
}

// POST /api/jobs
async function createJob(req, res, next) {
  try {
    const { error, values } = validateJobInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const job = await Job.create({ ...values, recruiter: req.user._id });

    return res.status(201).json({
      success: true,
      message: 'Job posted successfully.',
      data: job,
    });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/jobs/:id
async function updateJob(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job posting not found.' });

    if (String(job.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own job postings.' });
    }

    const { error, values } = validateJobInput({ ...job.toObject(), ...req.body });
    if (error) return res.status(400).json({ success: false, message: error });

    Object.assign(job, values);
    if (typeof req.body.isActive === 'boolean') job.isActive = req.body.isActive;
    await job.save();

    return res.status(200).json({
      success: true,
      message: 'Job updated successfully.',
      data: job,
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/jobs/:id
// Soft delete keeps old applications readable while hiding the job from listings.
async function deleteJob(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await Job.findById(req.params.id);
    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: 'Job posting not found.' });
    }

    if (String(job.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own job postings.' });
    }

    job.isActive = false;
    await job.save();

    return res.status(200).json({ success: true, message: 'Job posting deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getJobs, getJobMatches, getJobById, createJob, updateJob, deleteJob };
