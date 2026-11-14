// models/Resume.js
const mongoose = require('mongoose');
const { normalizeSkills } = require('../utils/skillExtractor');

const resumeSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one active resume per applicant
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    extractedSkills: {
      type: [String],
      default: [],
    },
    manualSkills: {
      type: [String],
      default: [],
    },
    // Combined list used for matching and candidate search.
    skills: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

resumeSchema.index({ skills: 1 });

// Keep the combined "skills" list in sync with extracted + manual skills.
resumeSchema.pre('save', function syncSkills(next) {
  this.extractedSkills = normalizeSkills(this.extractedSkills);
  this.manualSkills = normalizeSkills(this.manualSkills);
  this.skills = normalizeSkills([...this.extractedSkills, ...this.manualSkills]);
  next();
});

module.exports = mongoose.model('Resume', resumeSchema);
