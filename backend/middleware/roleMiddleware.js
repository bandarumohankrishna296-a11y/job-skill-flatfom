// middleware/roleMiddleware.js
// Role-based authorization. Use after protect().
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action is only available to ${roles.join(' / ')} accounts.`,
      });
    }

    return next();
  };
}

const applicantOnly = allowRoles('applicant');
const recruiterOnly = allowRoles('recruiter');

module.exports = { allowRoles, applicantOnly, recruiterOnly };
