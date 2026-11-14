// server.js
// Entry point for the Job Skill Matcher REST API.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const recruiterRoutes = require('./routes/recruiterRoutes');
const courseRoutes = require('./routes/courseRoutes');
const applicantRoutes = require('./routes/applicantRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
const configuredOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Tools such as curl/Postman do not send an Origin header.
      if (!origin) return callback(null, true);

      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (configuredOrigins.includes(origin) || (process.env.NODE_ENV === 'development' && isLocalhost)) {
        return callback(null, true);
      }

      return callback(new Error('This origin is not allowed by the server CORS configuration.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Job Skill Matcher API is running.',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timezoneForDailyLimit: 'Asia/Kolkata',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/applicant', applicantRoutes);
app.use('/api/notifications', notificationRoutes);

// The API can also serve the static frontend on http://localhost:5000.
// The recommended frontend address is still http://localhost:5500.
const frontendDirectory = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDirectory));

app.use(notFound);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`Job Skill Matcher API : http://localhost:${PORT}`);
    console.log(`Frontend (built-in)  : http://localhost:${PORT}/index.html`);
    console.log(`Health check         : http://localhost:${PORT}/api/health`);
    console.log(`Environment          : ${process.env.NODE_ENV || 'development'}`);
    console.log('--------------------------------------------------');
  });
}

startServer();

module.exports = app;
