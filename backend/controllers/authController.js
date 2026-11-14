// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isValidEmail, validatePassword, cleanText } = require('../utils/validators');

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    headline: user.headline,
    location: user.location,
    createdAt: user.createdAt,
  };
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const name = cleanText(req.body.name, 80);
    const email = cleanText(req.body.email, 120).toLowerCase();
    const { password, confirmPassword, role } = req.body;

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter your full name (minimum 2 characters).' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and confirm password do not match.' });
    }
    if (!['applicant', 'recruiter'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid account type.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });
    }

    const user = await User.create({ name, email, password, role });
    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const email = cleanText(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email and password.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name.split(' ')[0]}!`,
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  return res.status(200).json({ success: true, user: publicUser(req.user) });
}

// PATCH /api/auth/profile
async function updateProfile(req, res, next) {
  try {
    const name = cleanText(req.body.name, 80);
    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters long.' });
    }

    req.user.name = name;
    if (req.body.headline !== undefined) req.user.headline = cleanText(req.body.headline, 120);
    if (req.body.location !== undefined) req.user.location = cleanText(req.body.location, 80);

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: publicUser(req.user),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, getMe, updateProfile };
