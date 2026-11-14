// models/Job.js
const mongoose = require('mongoose');

const JOB_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'];
const EXPERIENCE_LEVELS = ['Fresher', 'Junior', 'Mid-level', 'Senior'];
const JOB_CATEGORIES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Python Developer',
  'Java Developer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'Database Developer',
  'Web Developer',
  'Other',
];

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: 120,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
      maxlength: 8000,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: 100,
    },
    jobType: {
      type: String,
      enum: JOB_TYPES,
      default: 'Full-time',
    },
    salaryRange: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Not disclosed',
    },
    experienceLevel: {
      type: String,
      enum: EXPERIENCE_LEVELS,
      default: 'Fresher',
    },
    category: {
      type: String,
      enum: JOB_CATEGORIES,
      default: 'Other',
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Used only by the seed script so running it again does not duplicate jobs.
    seedKey: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Indexes for common listing, filtering and recruiter queries.
jobSchema.index({ requiredSkills: 1 });
jobSchema.index({ title: 1, category: 1 });
jobSchema.index({ recruiter: 1, createdAt: -1 });
jobSchema.index({ isActive: 1, createdAt: -1 });
jobSchema.index({ isActive: 1, jobType: 1, experienceLevel: 1 });
jobSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Job', jobSchema);
module.exports.JOB_TYPES = JOB_TYPES;
module.exports.EXPERIENCE_LEVELS = EXPERIENCE_LEVELS;
module.exports.JOB_CATEGORIES = JOB_CATEGORIES;
