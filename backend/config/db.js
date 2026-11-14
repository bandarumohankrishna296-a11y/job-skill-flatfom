// config/db.js
// Connects the Express application to the local MongoDB database using Mongoose.
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/job_skill_matcher';

  try {
    const connection = await mongoose.connect(mongoUri, {
      // Fail quickly with a clear message if MongoDB is not running.
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB connected: ${connection.connection.host}/${connection.connection.name}`);
    return connection;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Start MongoDB locally and check MONGO_URI in backend/.env');
    process.exit(1);
  }
};

module.exports = connectDB;
