// models/Course.js
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
    },
    skill: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'All levels'],
      default: 'Beginner',
    },
    isFree: {
      type: Boolean,
      default: true,
    },
    seedKey: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true }
);

courseSchema.index({ skill: 1, title: 1 });
courseSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Course', courseSchema);
