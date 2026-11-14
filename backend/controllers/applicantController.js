// controllers/applicantController.js
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const DailyApplicationCounter = require('../models/DailyApplicationCounter');
const { normalizeSkills } = require('../utils/skillExtractor');
const { getKolkataDateKey } = require('../utils/dateUtils');

const DAILY_APPLICATION_LIMIT = 10;

// Aggregation used for "average job match" and "matching jobs" statistics.
// Only one page of data is ever returned to Node.js; aggregation runs in MongoDB.
async function getMatchStatistics(applicantSkills) {
  const skillsLower = normalizeSkills(applicantSkills).map((skill) => skill.toLowerCase());

  const [result] = await Job.aggregate([
    { $match: { isActive: true } },
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
              skillsLower,
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
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalJobs: { $sum: 1 },
              averageMatch: {
                $avg: {
                  $cond: [{ $gt: ['$totalRequired', 0] }, '$matchPercentage', null],
                },
              },
              matchingJobs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ['$totalRequired', 0] },
                        { $gte: ['$matchPercentage', 50] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        topMatches: [
          { $match: { matchPercentage: { $gt: 0 }, totalRequired: { $gt: 0 } } },
          { $sort: { matchPercentage: -1, createdAt: -1 } },
          { $limit: 3 },
          {
            $project: {
              title: 1,
              company: 1,
              location: 1,
              jobType: 1,
              salaryRange: 1,
              experienceLevel: 1,
              requiredSkills: 1,
              matchPercentage: 1,
              totalRequired: 1,
              matchedCount: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
  ]);

  const summary = result.summary[0] || {
    totalJobs: 0,
    averageMatch: 0,
    matchingJobs: 0,
  };

  return {
    totalJobs: summary.totalJobs,
    averageMatch: summary.averageMatch ? Math.round(summary.averageMatch) : 0,
    matchingJobs: summary.matchingJobs,
    topMatches: result.topMatches,
  };
}

// GET /api/applicant/dashboard
async function getApplicantDashboard(req, res, next) {
  try {
    const resume = await Resume.findOne({ applicant: req.user._id }).lean();
    const todayKey = getKolkataDateKey();

    const [totalApplications, statusRows, todayCounter, recentApplications, matchStats] =
      await Promise.all([
        Application.countDocuments({ applicant: req.user._id }),
        Application.aggregate([
          { $match: { applicant: req.user._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        DailyApplicationCounter.findOne({
          applicant: req.user._id,
          dateKey: todayKey,
        }).lean(),
        Application.find({ applicant: req.user._id })
          .populate('job', 'title company location jobType')
          .sort({ appliedAt: -1 })
          .limit(5)
          .lean(),
        getMatchStatistics(resume ? resume.skills : []),
      ]);

    const statusCounts = { Pending: 0, Shortlisted: 0, Accepted: 0, Rejected: 0 };
    for (const row of statusRows) statusCounts[row._id] = row.count;

    const usedToday = todayCounter ? todayCounter.count : 0;

    return res.status(200).json({
      success: true,
      profile: {
        name: req.user.name,
        email: req.user.email,
        headline: req.user.headline,
        location: req.user.location,
        memberSince: req.user.createdAt,
      },
      resume: resume
        ? {
            id: resume._id,
            originalName: resume.originalName,
            extractedSkills: resume.extractedSkills,
            manualSkills: resume.manualSkills,
            skills: resume.skills,
            uploadedAt: resume.updatedAt || resume.createdAt,
          }
        : null,
      stats: {
        totalApplications,
        averageMatch: matchStats.averageMatch,
        matchingJobs: matchStats.matchingJobs,
        totalJobs: matchStats.totalJobs,
      },
      statusCounts,
      recentApplications,
      topMatches: matchStats.topMatches,
      dailyLimit: {
        limit: DAILY_APPLICATION_LIMIT,
        used: usedToday,
        remaining: Math.max(0, DAILY_APPLICATION_LIMIT - usedToday),
        dateKey: todayKey,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getApplicantDashboard };
