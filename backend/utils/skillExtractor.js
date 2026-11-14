// utils/skillExtractor.js
// A small, explainable keyword-based skill extractor.
// It matches complete skill names (not partial words) and returns canonical skill names.

const TECHNICAL_SKILLS = [
  'Python',
  'Java',
  'JavaScript',
  'C',
  'C++',
  'HTML',
  'CSS',
  'React',
  'Node.js',
  'Express.js',
  'MongoDB',
  'MySQL',
  'SQL',
  'PostgreSQL',
  'Git',
  'GitHub',
  'AWS',
  'Docker',
  'Machine Learning',
  'Deep Learning',
  'Data Science',
  'Power BI',
  'Tableau',
  'Excel',
  'REST API',
  'Flask',
  'Django',
  'PHP',
  'Angular',
  'TypeScript',
];

// Different ways a skill can appear in a resume.
const SKILL_ALIASES = {
  Python: ['python', 'python3'],
  Java: ['java'],
  JavaScript: ['javascript', 'java script', 'js'],
  C: ['c'],
  'C++': ['c++', 'cpp'],
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3'],
  React: ['react', 'react.js', 'reactjs'],
  'Node.js': ['node.js', 'nodejs', 'node js'],
  'Express.js': ['express.js', 'expressjs', 'express js', 'express'],
  MongoDB: ['mongodb', 'mongo db'],
  MySQL: ['mysql'],
  SQL: ['sql'],
  PostgreSQL: ['postgresql', 'postgres'],
  Git: ['git'],
  GitHub: ['github', 'git hub'],
  AWS: ['aws', 'amazon web services'],
  Docker: ['docker'],
  'Machine Learning': ['machine learning', 'machine-learning', 'ml'],
  'Deep Learning': ['deep learning', 'deep-learning'],
  'Data Science': ['data science', 'data-science'],
  'Power BI': ['power bi', 'powerbi'],
  Tableau: ['tableau'],
  Excel: ['excel', 'ms excel', 'microsoft excel'],
  'REST API': ['rest api', 'rest apis', 'restful api', 'restful apis', 'rest-api'],
  Flask: ['flask'],
  Django: ['django'],
  PHP: ['php'],
  Angular: ['angular', 'angularjs', 'angular.js'],
  TypeScript: ['typescript', 'type script'],
};

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a regex that matches a whole skill name and avoids false positives.
// Example: "Java" must not match inside "JavaScript", and "SQL" must not match inside "MySQL".
function buildSkillPattern(skill, alias) {
  const escaped = escapeRegex(alias);

  if (skill === 'C') {
    // Do not count C when the CV says C++ or C#.
    return new RegExp('(?<![A-Za-z0-9+#])c(?![A-Za-z0-9+#])', 'i');
  }

  if (skill === 'JavaScript' && alias === 'js') {
    // Do not treat the "js" inside "Node.js" as JavaScript.
    return new RegExp('(?<![A-Za-z0-9.])js(?![A-Za-z0-9])', 'i');
  }

  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i');
}

// Pre-build all regexes once when the server starts.
const SKILL_PATTERNS = TECHNICAL_SKILLS.map((skill) => ({
  skill,
  patterns: SKILL_ALIASES[skill].map((alias) => buildSkillPattern(skill, alias)),
}));

/**
 * Extract technical skills from free text (resume text).
 * @param {string} text
 * @returns {string[]} canonical skill names in a stable order
 */
function extractSkills(text) {
  if (!text || typeof text !== 'string') return [];

  // Avoid scanning extremely large files repeatedly.
  const searchableText = text.slice(0, 300000);
  const found = [];

  for (const { skill, patterns } of SKILL_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(searchableText))) {
      found.push(skill);
    }
  }

  return found;
}

/**
 * Convert one skill to its official spelling when it is a known skill.
 * Unknown manual skills are cleaned and kept as entered.
 */
function normalizeSkill(rawSkill) {
  if (typeof rawSkill !== 'string') return '';

  const cleaned = rawSkill
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);

  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  for (const skill of TECHNICAL_SKILLS) {
    if (skill.toLowerCase() === lower) return skill;
    if (SKILL_ALIASES[skill].some((alias) => alias.toLowerCase() === lower)) {
      return skill;
    }
  }

  return cleaned;
}

/**
 * Normalize a list, remove duplicates (case-insensitive) and empty values.
 */
function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return [];

  const seen = new Set();
  const result = [];

  for (const rawSkill of skills) {
    const skill = normalizeSkill(rawSkill);
    if (!skill) continue;

    const key = skill.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(skill);
  }

  return result.slice(0, 60);
}

module.exports = {
  TECHNICAL_SKILLS,
  SKILL_ALIASES,
  extractSkills,
  normalizeSkill,
  normalizeSkills,
};
