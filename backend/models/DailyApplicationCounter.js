// models/DailyApplicationCounter.js
// One document per applicant per Asia/Kolkata calendar day.
// MongoDB's atomic $inc makes the 10-per-day rule safe under concurrent requests.
const mongoose = require('mongoose');

const dailyApplicationCounterSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dateKey: {
      type: String, // YYYY-MM-DD in Asia/Kolkata
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

dailyApplicationCounterSchema.index({ applicant: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('DailyApplicationCounter', dailyApplicationCounterSchema);
