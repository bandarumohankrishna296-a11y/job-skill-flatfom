// utils/courseRecommender.js
// Suggests courses and free search links for the skills a candidate is missing.
const { normalizeSkills } = require('./skillExtractor');

// Offline fallback recommendations. Normally the Course collection (seeded
// from seed/seedData.js) is used, but these keep the feature working even if
// the courses collection is empty.
const FALLBACK_COURSES = {
  Python: {
    title: 'Python for Everybody',
    platform: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/',
    description: 'Free beginner-friendly Python course with hands-on exercises.',
  },
  Java: {
    title: 'Java Programming Course',
    platform: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/news/learn-java-free-java-courses-for-beginners/',
    description: 'Curated free Java courses for beginners.',
  },
  React: {
    title: 'Learn React',
    platform: 'React Official Docs',
    url: 'https://react.dev/learn',
    description: 'Official React tutorial and documentation.',
  },
  'Node.js': {
    title: 'Introduction to Node.js',
    platform: 'Node.js Official Docs',
    url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
    description: 'Official Node.js getting-started guide.',
  },
  MongoDB: {
    title: 'MongoDB University',
    platform: 'MongoDB University',
    url: 'https://learn.mongodb.com/',
    description: 'Free MongoDB courses and labs.',
  },
  SQL: {
    title: 'SQL Tutorial',
    platform: 'W3Schools',
    url: 'https://www.w3schools.com/sql/',
    description: 'Beginner SQL tutorial with live examples.',
  },
  AWS: {
    title: 'AWS Skill Builder',
    platform: 'AWS Skill Builder',
    url: 'https://skillbuilder.aws/',
    description: 'Cloud learning resources from AWS.',
  },
  Docker: {
    title: 'Docker Getting Started',
    platform: 'Docker Docs',
    url: 'https://docs.docker.com/get-started/',
    description: 'Official Docker getting-started documentation.',
  },
};

const SEARCH_PLATFORMS = [
  {
    platform: 'YouTube',
    title: (skill) => `${skill} full course for beginners`,
    url: (skill) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${skill} full course for beginners`)}`,
  },
  {
    platform: 'Coursera',
    title: (skill) => `${skill} courses on Coursera`,
    url: (skill) => `https://www.coursera.org/search?query=${encodeURIComponent(skill)}`,
  },
  {
    platform: 'Udemy',
    title: (skill) => `${skill} courses on Udemy`,
    url: (skill) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`,
  },
  {
    platform: 'freeCodeCamp',
    title: (skill) => `${skill} tutorials on freeCodeCamp`,
    url: (skill) => `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(skill)}`,
  },
];

/**
 * Build recommendation objects for missing skills.
 * @param {string[]} missingSkills
 * @param {Array} dbCourses courses loaded from MongoDB
 */
function buildRecommendations(missingSkills, dbCourses = []) {
  const missing = normalizeSkills(missingSkills);
  const courses = [];
  const added = new Set();

  // First use courses stored in the database.
  for (const skill of missing) {
    const matches = dbCourses.filter(
      (course) => String(course.skill).toLowerCase() === skill.toLowerCase()
    );

    for (const course of matches) {
      const key = `${course.title}|${course.platform}`.toLowerCase();
      if (added.has(key)) continue;
      added.add(key);
      courses.push({
        id: course._id,
        skill,
        title: course.title,
        platform: course.platform,
        description: course.description,
        url: course.url,
        isFree: course.isFree,
      });
    }
  }

  // If a skill has no stored course, add a simple fallback.
  for (const skill of missing) {
    const hasCourse = courses.some((course) => course.skill.toLowerCase() === skill.toLowerCase());
    if (hasCourse) continue;

    const fallback = FALLBACK_COURSES[skill];
    if (fallback) {
      const key = `${fallback.title}|${fallback.platform}`.toLowerCase();
      if (!added.has(key)) {
        added.add(key);
        courses.push({ skill, ...fallback, isFree: true });
      }
    }
  }

  // Dynamic search links require no API key and always work.
  const searchLinks = [];
  for (const skill of missing.slice(0, 6)) {
    for (const source of SEARCH_PLATFORMS) {
      searchLinks.push({
        skill,
        platform: source.platform,
        title: source.title(skill),
        url: source.url(skill),
      });
    }
  }

  return {
    missingSkills: missing,
    courses,
    searchLinks,
  };
}

module.exports = { buildRecommendations };
