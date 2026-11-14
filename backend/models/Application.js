// models/Application.js
const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['Pending', 'Shortlisted', 'Accepted', 'Rejected'];

const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    // Stored directly for fast recruiter dashboard queries.
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'Pending',
    },
    matchPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    matchedSkills: {
      type: [String],
      default: [],
    },
    missingSkills: {
      type: [String],
      default: [],
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    // Asia/Kolkata date (YYYY-MM-DD) used to compute the daily limit.
    dateKey: {
      type: String,
      index: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: APPLICATION_STATUSES,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
  },
  { timestamps: true }
);

// A candidate can apply to the same job only once.
applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });
applicationSchema.index({ applicant: 1, appliedAt: -1 });
applicationSchema.index({ job: 1, appliedAt: -1 });
applicationSchema.index({ recruiter: 1, appliedAt: -1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ applicant: 1, dateKey: 1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
