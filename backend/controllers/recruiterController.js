// controllers/recruiterController.js
const User = require('../models/User');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const { normalizeSkills } = require('../utils/skillExtractor');
const { escapeRegex, isValidObjectId, parsePagination, buildPagination } = require('../utils/validators');

// GET /api/recruiter/dashboard
async function getRecruiterDashboard(req, res, next) {
  try {
    const recruiterId = req.user._id;

    const [
      totalJobs,
      totalApplications,
      applicantIds,
      shortlisted,
      accepted,
      pending,
      rejected,
      recentApplications,
      statusGroups,
      topJobs,
    ] = await Promise.all([
      Job.countDocuments({ recruiter: recruiterId, isActive: true }),
      Application.countDocuments({ recruiter: recruiterId }),
      Application.distinct('applicant', { recruiter: recruiterId }),
      Application.countDocuments({ recruiter: recruiterId, status: 'Shortlisted' }),
      Application.countDocuments({ recruiter: recruiterId, status: 'Accepted' }),
      Application.countDocuments({ recruiter: recruiterId, status: 'Pending' }),
      Application.countDocuments({ recruiter: recruiterId, status: 'Rejected' }),
      Application.find({ recruiter: recruiterId })
        .populate('applicant', 'name email headline location')
        .populate('job', 'title company location jobType isActive')
        .sort({ appliedAt: -1 })
        .limit(8)
        .lean(),
      Application.aggregate([
        { $match: { recruiter: recruiterId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { recruiter: recruiterId } },
        {
          $group: {
            _id: '$job',
            applications: { $sum: 1 },
            shortlisted: {
              $sum: { $cond: [{ $eq: ['$status', 'Shortlisted'] }, 1, 0] },
            },
          },
        },
        { $sort: { applications: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'jobs',
            localField: '_id',
            foreignField: '_id',
            as: 'job',
          },
        },
        { $unwind: '$job' },
        {
          $project: {
            _id: 0,
            jobId: '$job._id',
            title: '$job.title',
            company: '$job.company',
            isActive: '$job.isActive',
            applications: 1,
            shortlisted: 1,
          },
        },
      ]),
    ]);

    const statusCounts = { Pending: 0, Shortlisted: 0, Accepted: 0, Rejected: 0 };
    for (const group of statusGroups) {
      if (statusCounts[group._id] !== undefined) statusCounts[group._id] = group.count;
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          headline: req.user.headline,
        },
        stats: {
          totalJobs,
          totalApplicants: applicantIds.length,
          totalApplications,
          shortlisted,
          accepted,
          pending,
          rejected,
        },
        statusCounts,
        recentApplications,
        topJobs,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/recruiter/candidates?q=&jobId=&page=&limit=&skill=
async function searchCandidates(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const keyword = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const skill = typeof req.query.skill === 'string' ? req.query.skill.trim().slice(0, 50) : '';

    let selectedJob = null;
    if (req.query.jobId) {
      if (!isValidObjectId(req.query.jobId)) {
        return res.status(400).json({ success: false, message: 'Invalid job ID.' });
      }
      selectedJob = await Job.findById(req.query.jobId).lean();
      if (!selectedJob) {
        return res.status(404).json({ success: false, message: 'Job not found.' });
      }
      if (String(selectedJob.recruiter) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You can only match candidates against your own jobs.' });
      }
    }

    const pipeline = [
      { $match: { role: 'applicant' } },
      {
        $lookup: {
          from: 'resumes',
          localField: '_id',
          foreignField: 'applicant',
          as: 'resumeDocument',
        },
      },
      { $addFields: { resume: { $arrayElemAt: ['$resumeDocument', 0] } } },
    ];

    const searchRegexes = [];
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), 'i');
      searchRegexes.push(
        { name: regex },
        { email: regex },
        { headline: regex },
        { location: regex },
        { 'resume.extractedSkills': regex },
        { 'resume.manualSkills': regex },
        { 'resume.skills': regex }
      );
    }
    if (skill) {
      const skillRegex = new RegExp(escapeRegex(skill), 'i');
      searchRegexes.push(
        { 'resume.extractedSkills': skillRegex },
        { 'resume.manualSkills': skillRegex },
        { 'resume.skills': skillRegex }
      );
    }
    if (searchRegexes.length > 0) {
      pipeline.push({ $match: { $or: searchRegexes } });
    }

    if (selectedJob) {
      const jobSkills = normalizeSkills(selectedJob.requiredSkills);
      pipeline.push(
        {
          $addFields: {
            totalRequired: jobSkills.length,
            matchedCount: {
              $size: {
                $setIntersection: [
                  {
                    $map: {
                      input: jobSkills,
                      as: 'skill',
                      in: { $toLower: '$$skill' },
                    },
                  },
                  {
                    $map: {
                      input: { $ifNull: ['$resume.skills', []] },
                      as: 'skill',
                      in: { $toLower: '$$skill' },
                    },
                  },
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
                    { $multiply: [{ $divide: ['$matchedCount', '$totalRequired'] }, 100] },
                    0,
                  ],
                },
              ],
            },
          },
        }
      );
    }

    pipeline.push(
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          headline: 1,
          location: 1,
          createdAt: 1,
          resumeId: '$resume._id',
          resumeName: '$resume.originalName',
          resumeUpdatedAt: '$resume.updatedAt',
          hasResume: { $cond: [{ $ifNull: ['$resume._id', false] }, true, false] },
          extractedSkills: { $ifNull: ['$resume.extractedSkills', []] },
          manualSkills: { $ifNull: ['$resume.manualSkills', []] },
          skills: { $ifNull: ['$resume.skills', []] },
          ...(selectedJob
            ? { matchPercentage: 1, matchedCount: 1, totalRequired: 1 }
            : {}),
        },
      },
      {
        $sort: selectedJob
          ? { matchPercentage: -1, createdAt: -1 }
          : { createdAt: -1 },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      }
    );

    const [result] = await User.aggregate(pipeline);
    const total = result.total[0] ? result.total[0].count : 0;

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: buildPagination(page, limit, total),
      selectedJob: selectedJob
        ? {
            id: selectedJob._id,
            title: selectedJob.title,
            company: selectedJob.company,
            requiredSkills: selectedJob.requiredSkills,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/recruiter/candidates/:applicantId
// Full profile details are only shown to recruiters who received an application.
async function getCandidateDetails(req, res, next) {
  try {
    if (!isValidObjectId(req.params.applicantId)) {
      return res.status(400).json({ success: false, message: 'Invalid candidate ID.' });
    }

    const candidate = await User.findOne({ _id: req.params.applicantId, role: 'applicant' })
      .select('name email headline location createdAt')
      .lean();
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    const applications = await Application.find({
      applicant: candidate._id,
      recruiter: req.user._id,
    })
      .populate('job', 'title company location requiredSkills')
      .sort({ appliedAt: -1 })
      .lean();

    if (applications.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'This candidate has not applied to any of your jobs, so their full profile is private.',
      });
    }

    const resume = await Resume.findOne({ applicant: candidate._id })
      .select('originalName extractedSkills manualSkills skills updatedAt')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        candidate,
        resume: resume
          ? {
              id: resume._id,
              originalName: resume.originalName,
              extractedSkills: resume.extractedSkills,
              manualSkills: resume.manualSkills,
              skills: resume.skills,
              updatedAt: resume.updatedAt,
              downloadUrl: `/api/resumes/${resume._id}/download`,
            }
          : null,
        applications,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/recruiter/jobs
async function getRecruiterJobs(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { recruiter: req.user._id };
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: regex }, { company: regex }, { category: regex }];
    }
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Job.countDocuments(filter),
    ]);

    const jobIds = jobs.map((job) => job._id);
    const countGroups = jobIds.length === 0
      ? []
      : await Application.aggregate([
          { $match: { job: { $in: jobIds } } },
          {
            $group: {
              _id: '$job',
              applications: { $sum: 1 },
              shortlisted: {
                $sum: { $cond: [{ $eq: ['$status', 'Shortlisted'] }, 1, 0] },
              },
              accepted: {
                $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] },
              },
            },
          },
        ]);

    const counts = new Map(countGroups.map((group) => [String(group._id), group]));
    const data = jobs.map((job) => {
      const group = counts.get(String(job._id));
      return {
        ...job,
        applicationCount: group ? group.applications : 0,
        shortlistedCount: group ? group.shortlisted : 0,
        acceptedCount: group ? group.accepted : 0,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/recruiter/applications?jobId=&status=&page=&limit=
async function getRecruiterApplications(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { recruiter: req.user._id };

    if (req.query.jobId) {
      if (!isValidObjectId(req.query.jobId)) {
        return res.status(400).json({ success: false, message: 'Invalid job ID.' });
      }
      filter.job = req.query.jobId;
    }
    if (['Pending', 'Shortlisted', 'Accepted', 'Rejected'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('applicant', 'name email headline location')
        .populate('job', 'title company location jobType')
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
    ]);

    const resumes = await Resume.find({
      applicant: { $in: applications.map((item) => item.applicant).filter(Boolean).map((item) => item._id) },
    })
      .select('_id applicant originalName')
      .lean();
    const resumesByApplicant = new Map(resumes.map((resume) => [String(resume.applicant), resume]));

    const data = applications.map((application) => {
      const resume = application.applicant
        ? resumesByApplicant.get(String(application.applicant._id))
        : null;
      return {
        ...application,
        resume: resume
          ? {
              id: resume._id,
              originalName: resume.originalName,
              downloadUrl: `/api/resumes/${resume._id}/download`,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRecruiterDashboard,
  searchCandidates,
  getCandidateDetails,
  getRecruiterJobs,
  getRecruiterApplications,
};
