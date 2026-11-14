// middleware/uploadMiddleware.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'resumes');
fs.mkdirSync(uploadDirectory, { recursive: true });

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // some Windows/browser combinations use this for DOCX
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    // Random server-side filename avoids path traversal and name collisions.
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
    cb(null, uniqueName);
  },
});

function fileFilter(req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    const error = new Error('Only PDF and DOCX resume files are allowed.');
    error.statusCode = 400;
    return cb(error);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('Invalid file type. Please upload a PDF or DOCX resume.');
    error.statusCode = 400;
    return cb(error);
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

module.exports = { upload, uploadDirectory };
