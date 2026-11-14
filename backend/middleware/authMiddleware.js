// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

async function verifyTokenAndLoadUser(req) {
  const token = getTokenFromHeader(req);
  if (!token) {
    const error = new Error('Authentication required. Please log in.');
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const error = new Error(
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token.'
    );
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    const error = new Error('User account no longer exists.');
    error.statusCode = 401;
    throw error;
  }

  return user;
}

// Required authentication for protected routes.
async function protect(req, res, next) {
  try {
    req.user = await verifyTokenAndLoadUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

// Used by public job pages so logged-in applicants can see match percentages,
// but visitors can still browse jobs without an account.
async function optionalAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return next();

  try {
    req.user = await verifyTokenAndLoadUser(req);
  } catch (error) {
    req.user = null; // Ignore bad/expired tokens on public routes.
  }

  return next();
}

module.exports = { protect, optionalAuth };
