// utils/matchCalculator.js
// Implements the academic project's matching formula:
// Match % = (matching skills / total required skills) * 100
const { normalizeSkills } = require('./skillExtractor');

/**
 * Compare an applicant's skills with the skills required by a job.
 * @param {string[]} applicantSkills
 * @param {string[]} requiredSkills
 * @returns {{ matchPercentage:number, matchedSkills:string[], missingSkills:string[],
 *             totalRequired:number, matchedCount:number }}
 */
function calculateMatch(applicantSkills, requiredSkills) {
  const required = normalizeSkills(requiredSkills);
  const applicant = normalizeSkills(applicantSkills);
  const applicantSet = new Set(applicant.map((skill) => skill.toLowerCase()));

  const matchedSkills = required.filter((skill) => applicantSet.has(skill.toLowerCase()));
  const missingSkills = required.filter((skill) => !applicantSet.has(skill.toLowerCase()));
  const totalRequired = required.length;

  // Jobs with no required skills are handled safely.
  const matchPercentage = totalRequired === 0
    ? 0
    : Math.round((matchedSkills.length / totalRequired) * 100);

  return {
    matchPercentage,
    matchedSkills,
    missingSkills,
    totalRequired,
    matchedCount: matchedSkills.length,
  };
}

module.exports = { calculateMatch };
