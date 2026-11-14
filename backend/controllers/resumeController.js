// controllers/resumeController.js
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const { uploadDirectory } = require('../middleware/uploadMiddleware');
const { extractSkills, normalizeSkills } = require('../utils/skillExtractor');
const { isValidObjectId } = require('../utils/validators');

function removeFileQuietly(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {
    // The file may already have been removed; this is safe to ignore.
  });
}

function absoluteStoredPath(storedName) {
  // basename() prevents path traversal even if the database value is unusual.
  return path.join(uploadDirectory, path.basename(storedName));
}

function resumeResponse(resume) {
  if (!resume) {
    return { hasResume: false, resume: null };
  }

  return {
    hasResume: true,
    resume: {
      id: resume._id,
      originalName: resume.originalName,
      mimeType: resume.mimeType,
      size: resume.size,
      extractedSkills: resume.extractedSkills,
      manualSkills: resume.manualSkills,
      skills: resume.skills,
      uploadedAt: resume.updatedAt || resume.createdAt,
      downloadUrl: `/api/resumes/${resume._id}/download`,
    },
  };
}

async function extractTextFromFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension === '.pdf') {
    const dataBuffer = await fs.promises.readFile(file.path);
    const parsed = await pdfParse(dataBuffer);
    return parsed.text || '';
  }

  if (extension === '.docx') {
    const parsed = await mammoth.extractRawText({ path: file.path });
    return parsed.value || '';
  }

  throw new Error('Unsupported resume format.');
}

// POST /api/resumes/upload (applicant only)
async function uploadResume(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please choose a PDF or DOCX resume file.' });
  }

  const newFilePath = req.file.path;

  try {
    let resumeText = '';
    try {
      resumeText = await extractTextFromFile(req.file);
    } catch (parseError) {
      removeFileQuietly(newFilePath);
      return res.status(400).json({
        success: false,
        message: 'We could not read this file. Please upload a text-based PDF or a DOCX resume.',
      });
    }

    if (!resumeText || resumeText.replace(/\s+/g, '').length < 20) {
      removeFileQuietly(newFilePath);
      return res.status(400).json({
        success: false,
        message: 'The resume appears to be empty or scanned as an image. Please upload a text-based PDF or DOCX file.',
      });
    }

    const extractedSkills = extractSkills(resumeText);
    const existingResume = await Resume.findOne({ applicant: req.user._id }).lean();
    const manualSkills = existingResume ? existingResume.manualSkills : [];
    const allSkills = normalizeSkills([...extractedSkills, ...manualSkills]);

    const resume = await Resume.findOneAndUpdate(
      { applicant: req.user._id },
      {
        $set: {
          applicant: req.user._id,
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          extractedSkills,
          manualSkills,
          skills: allSkills,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Delete the previous file only after the new resume has been saved.
    if (existingResume && existingResume.storedName && existingResume.storedName !== req.file.filename) {
      removeFileQuietly(absoluteStoredPath(existingResume.storedName));
    }

    return res.status(201).json({
      success: true,
      message: extractedSkills.length > 0
        ? `Resume uploaded. ${extractedSkills.length} technical skills were detected.`
        : 'Resume uploaded successfully. No known technical skills were detected; you can add skills manually.',
      ...resumeResponse(resume),
    });
  } catch (error) {
    removeFileQuietly(newFilePath);
    return next(error);
  }
}

// GET /api/resumes/my-resume (applicant only)
async function getMyResume(req, res, next) {
  try {
    const resume = await Resume.findOne({ applicant: req.user._id }).lean();
    return res.status(200).json({ success: true, ...resumeResponse(resume) });
  } catch (error) {
    return next(error);
  }
}

// GET /api/resumes/skills (applicant only)
async function getMySkills(req, res, next) {
  try {
    const resume = await Resume.findOne({ applicant: req.user._id }).lean();
    return res.status(200).json({
      success: true,
      hasResume: Boolean(resume),
      extractedSkills: resume ? resume.extractedSkills : [],
      manualSkills: resume ? resume.manualSkills : [],
      skills: resume ? resume.skills : [],
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/resumes/skills
// Lets the applicant correct extracted skills and maintain their own manual list.
async function updateMySkills(req, res, next) {
  try {
    const resume = await Resume.findOne({ applicant: req.user._id });
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Upload a resume before editing skills.',
      });
    }

    const hasExtracted = Array.isArray(req.body.extractedSkills);
    const hasManual = Array.isArray(req.body.manualSkills);

    if (!hasExtracted && !hasManual) {
      return res.status(400).json({
        success: false,
        message: 'Provide extractedSkills and/or manualSkills as arrays.',
      });
    }

    if (hasExtracted) {
      if (req.body.extractedSkills.length > 60) {
        return res.status(400).json({ success: false, message: 'Please provide at most 60 extracted skills.' });
      }
      resume.extractedSkills = normalizeSkills(req.body.extractedSkills);
    }

    if (hasManual) {
      if (req.body.manualSkills.length > 60) {
        return res.status(400).json({ success: false, message: 'Please provide at most 60 manual skills.' });
      }
      resume.manualSkills = normalizeSkills(req.body.manualSkills);
    }

    await resume.save();

    return res.status(200).json({
      success: true,
      message: 'Skills updated successfully.',
      extractedSkills: resume.extractedSkills,
      manualSkills: resume.manualSkills,
      skills: resume.skills,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/resumes/:id/download
// Allowed for the owner or a recruiter who received an application from that applicant.
async function downloadResume(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
    }

    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    const isOwner = String(resume.applicant) === String(req.user._id);
    let isAuthorizedRecruiter = false;

    if (!isOwner && req.user.role === 'recruiter') {
      isAuthorizedRecruiter = Boolean(
        await Application.exists({ applicant: resume.applicant, recruiter: req.user._id })
      );
    }

    if (!isOwner && !isAuthorizedRecruiter) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to download this resume.',
      });
    }

    const storedPath = absoluteStoredPath(resume.storedName);
    if (!fs.existsSync(storedPath)) {
      return res.status(404).json({ success: false, message: 'The stored resume file was not found.' });
    }

    const downloadName = path.basename(resume.originalName || 'resume.pdf').replace(/["\r\n]/g, '_');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(storedPath, downloadName, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/resumes/:id
async function deleteResume(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
    }

    const resume = await Resume.findOne({ _id: req.params.id, applicant: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    removeFileQuietly(absoluteStoredPath(resume.storedName));
    await Resume.deleteOne({ _id: resume._id });

    return res.status(200).json({ success: true, message: 'Resume deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadResume,
  getMyResume,
  getMySkills,
  updateMySkills,
  downloadResume,
  deleteResume,
};
