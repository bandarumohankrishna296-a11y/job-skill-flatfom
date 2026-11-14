// controllers/applicationController.js
const Application = require('../models/Application');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const DailyApplicationCounter = require('../models/DailyApplicationCounter');
const Notification = require('../models/Notification');
const { calculateMatch } = require('../utils/matchCalculator');
const { normalizeSkills } = require('../utils/skillExtractor');
const { getKolkataDateKey } = require('../utils/dateUtils');
const { notifyUser } = require('../utils/notificationHelper');
const {
  isValidObjectId,
  parsePagination,
  buildPagination,
} = require('../utils/validators');

const DAILY_APPLICATION_LIMIT = 10;

/**
 * Atomically reserve one application slot in MongoDB.
 * $inc is atomic, so concurrent requests cannot both "see" the same count.
 */
async function reserveDailySlot(applicantId, dateKey) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counter = await DailyApplicationCounter.findOneAndUpdate(
        { applicant: applicantId, dateKey },
        { $inc: { count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (counter.count > DAILY_APPLICATION_LIMIT) {
        // Undo the reservation when the limit has already been reached.
        await DailyApplicationCounter.updateOne(
          { _id: counter._id, count: { $gt: 0 } },
          { $inc: { count: -1 } }
        );
        return { allowed: false, count: counter.count - 1 };
      }

      return { allowed: true, count: counter.count };
    } catch (error) {
      // Two concurrent first-time upserts can race on the unique index. Retry.
      if (error.code === 11000) continue;
      throw error;
    }
  }

  const error = new Error('Could not process the daily application limit. Please try again.');
  error.statusCode = 503;
  throw error;
}

async function releaseDailySlot(applicantId, dateKey) {
  await DailyApplicationCounter.updateOne(
    { applicant: applicantId, dateKey, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}

// POST /api/applications/apply/:jobId (applicant only)
async function applyForJob(req, res, next) {
  const { jobId } = req.params;
  const applicantId = req.user._id;

  if (!isValidObjectId(jobId)) {
    return res.status(400).json({ success: false, message: 'Invalid job ID.' });
  }

  try {
    const job = await Job.findOne({ _id: jobId, isActive: true });
    if (!job) {
      return res.status(404).json({ success: false, message: 'This job is no longer available.' });
    }

    const duplicate = await Application.findOne({ applicant: applicantId, job: job._id }).lean();
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied for this job.',
      });
    }

    const resume = await Resume.findOne({ applicant: applicantId }).lean();
    const applicantSkills = normalizeSkills(resume ? resume.skills : []);
    const match = calculateMatch(applicantSkills, job.requiredSkills);
    const dateKey = getKolkataDateKey();

    const reservation = await reserveDailySlot(applicantId, dateKey);
    if (!reservation.allowed) {
      return res.status(429).json({
        success: false,
        message: `Daily limit reached. You can submit a maximum of ${DAILY_APPLICATION_LIMIT} job applications per day (Asia/Kolkata). Please try again tomorrow.`,
        dailyLimit: DAILY_APPLICATION_LIMIT,
        applicationsToday: DAILY_APPLICATION_LIMIT,
      });
    }

    let application;
    try {
      application = await Application.create({
        applicant: applicantId,
        job: job._id,
        recruiter: job.recruiter,
        status: 'Pending',
        matchPercentage: match.matchPercentage,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        appliedAt: new Date(),
        dateKey,
        statusHistory: [{ status: 'Pending', changedAt: new Date(), changedBy: applicantId }],
      });
    } catch (error) {
      // The reservation must be returned if saving the application fails.
      await releaseDailySlot(applicantId, dateKey);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You have already applied for this job.',
        });
      }
      throw error;
    }

    await Promise.all([
      notifyUser({
        user: applicantId,
        type: 'application_submitted',
        title: 'Application submitted',
        message: `Your application for "${job.title}" at ${job.company} was submitted successfully.`,
        application: application._id,
      }),
      notifyUser({
        user: job.recruiter,
        type: 'new_application',
        title: 'New job application',
        message: `${req.user.name} applied for "${job.title}". Match score: ${match.matchPercentage}%.`,
        application: application._id,
      }),
    ]);

    return res.status(201).json({
      success: true,
      message: `Application submitted successfully. Your skill match is ${match.matchPercentage}%.`,
      data: {
        id: application._id,
        status: application.status,
        appliedAt: application.appliedAt,
        matchPercentage: application.matchPercentage,
        matchedSkills: application.matchedSkills,
        missingSkills: application.missingSkills,
      },
      applicationsToday: reservation.count,
      dailyLimit: DAILY_APPLICATION_LIMIT,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/applications/my-applications (applicant only)
async function getMyApplications(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { applicant: req.user._id };

    if (['Pending', 'Shortlisted', 'Accepted', 'Rejected'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const todayKey = getKolkataDateKey();

    const [applications, total, statusGroups, counter] = await Promise.all([
      Application.find(filter)
        .populate('job', 'title company location jobType requiredSkills isActive')
        .populate('recruiter', 'name')
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
      Application.aggregate([
        { $match: { applicant: req.user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DailyApplicationCounter.findOne({ applicant: req.user._id, dateKey: todayKey }).lean(),
    ]);

    const statusCounts = { Pending: 0, Shortlisted: 0, Accepted: 0, Rejected: 0 };
    for (const group of statusGroups) {
      if (statusCounts[group._id] !== undefined) statusCounts[group._id] = group.count;
    }

    const usedToday = counter ? counter.count : 0;

    return res.status(200).json({
      success: true,
      data: applications,
      statusCounts,
      dailyLimit: {
        limit: DAILY_APPLICATION_LIMIT,
        used: usedToday,
        remaining: Math.max(0, DAILY_APPLICATION_LIMIT - usedToday),
        dateKey: todayKey,
      },
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/applications/dashboard (applicant only)
// All values below are calculated from MongoDB records.
async function getApplicantDashboard(req, res, next) {
  try {
    const applicantId = req.user._id;
    const resume = await Resume.findOne({ applicant: applicantId }).lean();
    const applicantSkills = normalizeSkills(resume ? resume.skills : []);
    const skillsLower = applicantSkills.map((skill) => skill.toLowerCase());
    const todayKey = getKolkataDateKey();

    const [applicationStats, statusGroups, recentApplications, resumeSummary, counter, unreadNotifications, matchingJobs, totalJobs] =
      await Promise.all([
        Application.aggregate([
          { $match: { applicant: applicantId } },
          {
            $group: {
              _id: null,
              totalApplications: { $sum: 1 },
              averageMatch: { $avg: '$matchPercentage' },
            },
          },
        ]),
        Application.aggregate([
          { $match: { applicant: applicantId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Application.find({ applicant: applicantId })
          .populate('job', 'title company location jobType isActive')
          .sort({ appliedAt: -1 })
          .limit(6)
          .lean(),
        Resume.findOne({ applicant: applicantId })
          .select('originalName size extractedSkills manualSkills skills updatedAt')
          .lean(),
        DailyApplicationCounter.findOne({ applicant: applicantId, dateKey: todayKey }).lean(),
        Notification.countDocuments({ user: applicantId, isRead: false }),
        skillsLower.length === 0
          ? Promise.resolve([{ count: 0 }])
          : Job.aggregate([
              { $match: { isActive: true } },
              {
                $addFields: {
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
                        skillsLower,
                      ],
                    },
                  },
                },
              },
              { $match: { matchedCount: { $gt: 0 } } },
              { $count: 'count' },
            ]),
        Job.countDocuments({ isActive: true }),
      ]);

    const stats = applicationStats[0] || { totalApplications: 0, averageMatch: 0 };
    const statusCounts = { Pending: 0, Shortlisted: 0, Accepted: 0, Rejected: 0 };
    for (const group of statusGroups) {
      if (statusCounts[group._id] !== undefined) statusCounts[group._id] = group.count;
    }

    const usedToday = counter ? counter.count : 0;

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          headline: req.user.headline,
          location: req.user.location,
        },
        resume: resumeSummary
          ? {
              id: resumeSummary._id,
              originalName: resumeSummary.originalName,
              size: resumeSummary.size,
              uploadedAt: resumeSummary.updatedAt,
              extractedSkills: resumeSummary.extractedSkills,
              manualSkills: resumeSummary.manualSkills,
              skills: resumeSummary.skills,
              downloadUrl: `/api/resumes/${resumeSummary._id}/download`,
            }
          : null,
        skills: applicantSkills,
        stats: {
          totalApplications: stats.totalApplications,
          averageMatch: Math.round(stats.averageMatch || 0),
          matchingJobs: matchingJobs[0] ? matchingJobs[0].count : 0,
          totalJobs,
          unreadNotifications,
          applicationsToday: usedToday,
          dailyLimit: DAILY_APPLICATION_LIMIT,
          remainingToday: Math.max(0, DAILY_APPLICATION_LIMIT - usedToday),
        },
        statusCounts,
        recentApplications,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/applications/job/:jobId (recruiter owner only)
async function getJobApplications(req, res, next) {
  try {
    if (!isValidObjectId(req.params.jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID.' });
    }

    const job = await Job.findById(req.params.jobId).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    if (String(job.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only view applicants for your own jobs.' });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const filter = { job: job._id };
    if (['Pending', 'Shortlisted', 'Accepted', 'Rejected'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('applicant', 'name email headline location')
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
      job: { id: job._id, title: job.title, company: job.company, requiredSkills: job.requiredSkills },
      data,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/applications/:id/status (recruiter owner only)
async function updateApplicationStatus(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid application ID.' });
    }

    const { status } = req.body;
    if (!['Pending', 'Shortlisted', 'Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be Pending, Shortlisted, Accepted or Rejected.',
      });
    }

    const application = await Application.findById(req.params.id).populate('job', 'title company');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (String(application.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only update applications for your own jobs.' });
    }

    application.status = status;
    application.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
    });
    await application.save();

    await notifyUser({
      user: application.applicant,
      type: 'application_status',
      title: `Application ${status.toLowerCase()}`,
      message: `Your application for "${application.job.title}" at ${application.job.company} is now ${status}.`,
      application: application._id,
    });

    return res.status(200).json({
      success: true,
      message: `Application status changed to ${status}.`,
      data: {
        id: application._id,
        status: application.status,
        statusHistory: application.statusHistory,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  applyForJob,
  getMyApplications,
  getApplicantDashboard,
  getJobApplications,
  updateApplicationStatus,
  DAILY_APPLICATION_LIMIT,
};
