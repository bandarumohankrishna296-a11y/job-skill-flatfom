// seed/seedData.js
// Run with: npm run seed
// Safe to run more than once: all seed records use stable unique keys.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const connectDB = require('../config/db');

const User = require('../models/User');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const Course = require('../models/Course');
const Notification = require('../models/Notification');
const { extractSkills, normalizeSkills } = require('../utils/skillExtractor');
const { calculateMatch } = require('../utils/matchCalculator');
const { getKolkataDateKey } = require('../utils/dateUtils');

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'resumes');
const samplesDirectory = path.join(__dirname, 'samples');
fs.mkdirSync(uploadDirectory, { recursive: true });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const DEMO_USERS = [
  {
    key: 'demoApplicant',
    name: 'Ananya Sharma',
    email: 'applicant@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Final-year B.Tech AI & DS student | Aspiring Full Stack Developer',
    location: 'Chennai, Tamil Nadu',
  },
  {
    key: 'demoRecruiter',
    name: 'Rahul Verma',
    email: 'recruiter@demo.com',
    password: 'Recruiter@123',
    role: 'recruiter',
    headline: 'Technical Hiring Lead at TalentBridge',
    location: 'Bengaluru, Karnataka',
  },
  {
    key: 'technovaRecruiter',
    name: 'Priya Nair',
    email: 'hr@technova.com',
    password: 'Recruiter@123',
    role: 'recruiter',
    headline: 'HR Manager at TechNova Solutions',
    location: 'Bengaluru, Karnataka',
  },
  {
    key: 'datacoreRecruiter',
    name: 'Arjun Mehta',
    email: 'hiring@datacore.com',
    password: 'Recruiter@123',
    role: 'recruiter',
    headline: 'Talent Acquisition at DataCore Analytics',
    location: 'Hyderabad, Telangana',
  },
  {
    key: 'karthik',
    name: 'Karthik Raman',
    email: 'karthik@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Aspiring Data Analyst | Python and SQL',
    location: 'Coimbatore, Tamil Nadu',
  },
  {
    key: 'neha',
    name: 'Neha Kapoor',
    email: 'neha@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Frontend Developer | React and TypeScript',
    location: 'Delhi',
  },
  {
    key: 'vivek',
    name: 'Vivek Singh',
    email: 'vivek@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Backend Developer | Node.js and MongoDB',
    location: 'Pune, Maharashtra',
  },
  {
    key: 'fatima',
    name: 'Fatima Khan',
    email: 'fatima@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Java Developer | SQL and REST APIs',
    location: 'Mumbai, Maharashtra',
  },
  {
    key: 'rohan',
    name: 'Rohan Das',
    email: 'rohan@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Python Backend Developer | Django and AWS',
    location: 'Kolkata, West Bengal',
  },
  {
    key: 'ishita',
    name: 'Ishita Bose',
    email: 'ishita@demo.com',
    password: 'Applicant@123',
    role: 'applicant',
    headline: 'Data Science enthusiast | Machine Learning',
    location: 'Bengaluru, Karnataka',
  },
];

// ---------------------------------------------------------------------------
// 20 sample jobs. seedKey makes re-running the seed safe.
// ---------------------------------------------------------------------------
const SAMPLE_JOBS = [
  {
    seedKey: 'job-full-stack-technova',
    title: 'Full Stack Developer',
    company: 'TechNova Solutions',
    category: 'Full Stack Developer',
    location: 'Bengaluru, Karnataka',
    jobType: 'Full-time',
    salaryRange: '₹8 - ₹14 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'Express.js', 'MongoDB', 'REST API', 'Git', 'HTML', 'CSS', 'AWS'],
    description: 'Design and build end-to-end web applications using the MERN stack. You will work with product managers and designers to deliver responsive interfaces, secure REST APIs and MongoDB-backed services. Experience with Git-based collaboration and cloud deployment is expected.',
  },
  {
    seedKey: 'job-frontend-pixelcraft',
    title: 'Frontend Developer',
    company: 'PixelCraft Studio',
    category: 'Frontend Developer',
    location: 'Remote',
    jobType: 'Remote',
    salaryRange: '₹6 - ₹10 LPA',
    experienceLevel: 'Junior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'Git', 'GitHub', 'REST API'],
    description: 'Create polished, accessible user interfaces for client web products. The role involves converting Figma designs into responsive React components, integrating REST APIs, and maintaining a reusable component library with Git and GitHub.',
  },
  {
    seedKey: 'job-backend-cloudsprint',
    title: 'Backend Developer',
    company: 'CloudSprint Technologies',
    category: 'Backend Developer',
    location: 'Hyderabad, Telangana',
    jobType: 'Full-time',
    salaryRange: '₹10 - ₹16 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Node.js', 'Express.js', 'MongoDB', 'REST API', 'AWS', 'Docker', 'Git', 'PostgreSQL'],
    description: 'Build scalable backend services and REST APIs with Node.js and Express.js. You will design MongoDB and PostgreSQL data models, containerize services with Docker, and deploy workloads on AWS while collaborating through Git.',
  },
  {
    seedKey: 'job-python-dataminds',
    title: 'Python Developer',
    company: 'DataMinds AI',
    category: 'Python Developer',
    location: 'Pune, Maharashtra',
    jobType: 'Full-time',
    salaryRange: '₹7 - ₹12 LPA',
    experienceLevel: 'Junior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Python', 'Flask', 'Django', 'SQL', 'PostgreSQL', 'REST API', 'Git', 'Docker'],
    description: 'Develop internal tools and customer-facing APIs in Python using Flask and Django. Candidates should be comfortable writing SQL queries, designing REST endpoints, using Git for version control, and packaging services with Docker.',
  },
  {
    seedKey: 'job-java-finedge',
    title: 'Java Developer',
    company: 'FinEdge Systems',
    category: 'Java Developer',
    location: 'Mumbai, Maharashtra',
    jobType: 'Full-time',
    salaryRange: '₹8 - ₹13 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Java', 'SQL', 'MySQL', 'Git', 'HTML', 'CSS', 'REST API'],
    description: 'Join the payments engineering team to build reliable Java services for financial products. The role includes writing SQL queries against MySQL, exposing REST APIs, and collaborating with frontend developers to integrate HTML and CSS views.',
  },
  {
    seedKey: 'job-data-analyst-insightlab',
    title: 'Data Analyst',
    company: 'InsightLab Analytics',
    category: 'Data Analyst',
    location: 'Gurugram, Haryana',
    jobType: 'Full-time',
    salaryRange: '₹5 - ₹9 LPA',
    experienceLevel: 'Fresher',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['SQL', 'Excel', 'Power BI', 'Tableau', 'Python', 'Data Science'],
    description: 'Work with business teams to clean data, build dashboards and report insights. You will write SQL queries, prepare Excel models, and create Power BI and Tableau dashboards. Basic Python and data science knowledge is useful for automation.',
  },
  {
    seedKey: 'job-data-scientist-dataminds',
    title: 'Data Scientist',
    company: 'DataMinds AI',
    category: 'Data Scientist',
    location: 'Bengaluru, Karnataka',
    jobType: 'Full-time',
    salaryRange: '₹12 - ₹20 LPA',
    experienceLevel: 'Senior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'Data Science', 'SQL', 'Tableau'],
    description: 'Lead applied machine learning projects from problem framing to production. You will build models with Python, evaluate deep learning approaches, query data with SQL, and communicate findings through Tableau dashboards.',
  },
  {
    seedKey: 'job-ml-neuralworks',
    title: 'Machine Learning Engineer',
    company: 'NeuralWorks Labs',
    category: 'Machine Learning Engineer',
    location: 'Remote',
    jobType: 'Remote',
    salaryRange: '₹14 - ₹22 LPA',
    experienceLevel: 'Senior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'Data Science', 'Docker', 'AWS'],
    description: 'Develop and deploy machine learning systems at scale. Responsibilities include model training in Python, experiment tracking, containerization with Docker, and deploying inference services on AWS.',
  },
  {
    seedKey: 'job-database-coredb',
    title: 'Database Developer',
    company: 'CoreDB Solutions',
    category: 'Database Developer',
    location: 'Noida, Uttar Pradesh',
    jobType: 'Full-time',
    salaryRange: '₹6 - ₹11 LPA',
    experienceLevel: 'Junior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Python'],
    description: 'Design and optimize relational and document databases. You will write stored procedures, tune SQL queries, model MongoDB collections, and build small Python utilities for data migration and validation.',
  },
  {
    seedKey: 'job-web-brightweb',
    title: 'Web Developer',
    company: 'BrightWeb Agency',
    category: 'Web Developer',
    location: 'Jaipur, Rajasthan',
    jobType: 'Full-time',
    salaryRange: '₹4 - ₹7 LPA',
    experienceLevel: 'Fresher',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL', 'Git'],
    description: 'Build responsive marketing websites and small business applications. The job involves HTML, CSS and JavaScript on the frontend, PHP and MySQL on the backend, and disciplined use of Git for source control.',
  },
  {
    seedKey: 'job-react-pixelcraft',
    title: 'React Developer',
    company: 'PixelCraft Studio',
    category: 'Frontend Developer',
    location: 'Remote',
    jobType: 'Contract',
    salaryRange: '₹7 - ₹12 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['JavaScript', 'React', 'TypeScript', 'HTML', 'CSS', 'Git'],
    description: 'Work on a six-month contract to modernize a SaaS dashboard. You will build reusable React components in TypeScript, improve accessibility using semantic HTML and CSS, and collaborate through Git pull requests.',
  },
  {
    seedKey: 'job-mern-cloudsprint',
    title: 'Full Stack Developer (MERN)',
    company: 'CloudSprint Technologies',
    category: 'Full Stack Developer',
    location: 'Chennai, Tamil Nadu',
    jobType: 'Full-time',
    salaryRange: '₹9 - ₹15 LPA',
    experienceLevel: 'Junior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['MongoDB', 'Express.js', 'React', 'Node.js', 'JavaScript', 'Git', 'REST API'],
    description: 'Build a customer portal using MongoDB, Express.js, React and Node.js. You will implement REST APIs, write reusable frontend components, connect to cloud services, and contribute through Git-based code reviews.',
  },
  {
    seedKey: 'job-python-backend-finedge',
    title: 'Backend Developer - Python',
    company: 'FinEdge Systems',
    category: 'Backend Developer',
    location: 'Bengaluru, Karnataka',
    jobType: 'Full-time',
    salaryRange: '₹9 - ₹14 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Python', 'Django', 'PostgreSQL', 'REST API', 'Docker', 'AWS', 'Git'],
    description: 'Develop secure Python backend services using Django and PostgreSQL. You will design REST APIs, containerize applications with Docker, deploy on AWS, and work closely with product and security teams.',
  },
  {
    seedKey: 'job-data-analyst-insightlab-2',
    title: 'Junior Data Analyst',
    company: 'InsightLab Analytics',
    category: 'Data Analyst',
    location: 'Hyderabad, Telangana',
    jobType: 'Full-time',
    salaryRange: '₹6 - ₹10 LPA',
    experienceLevel: 'Junior',
    recruiterKey: 'demoRecruiter',
    requiredSkills: ['Python', 'SQL', 'Excel', 'Power BI', 'Tableau'],
    description: 'Support client reporting with clean datasets and interactive dashboards. The role requires Python for data preparation, SQL for analysis, Excel for ad-hoc reports, and Power BI or Tableau for visualization.',
  },
  {
    seedKey: 'job-frontend-brightweb',
    title: 'Frontend Developer',
    company: 'BrightWeb Agency',
    category: 'Frontend Developer',
    location: 'Pune, Maharashtra',
    jobType: 'Full-time',
    salaryRange: '₹5 - ₹8 LPA',
    experienceLevel: 'Fresher',
    recruiterKey: 'technovaRecruiter',
    requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git'],
    description: 'Join a friendly web team building responsive interfaces for retail clients. You will convert designs into HTML and CSS, add interactivity with JavaScript and React, and manage work using Git branches.',
  },
  {
    seedKey: 'job-python-neuralworks',
    title: 'Junior Python Developer',
    company: 'NeuralWorks Labs',
    category: 'Python Developer',
    location: 'Remote',
    jobType: 'Remote',
    salaryRange: '₹6 - ₹10 LPA',
    experienceLevel: 'Fresher',
    recruiterKey: 'datacoreRecruiter',
    requiredSkills: ['Python', 'Flask', 'SQL', 'Git'],
    description: 'Build small Python services and automation scripts with Flask. You will write SQL queries, maintain clean repositories with Git, and work with senior engineers to learn production development practices.',
  },
  {
    seedKey: 'job-full-stack-datacore',
    title: 'Full Stack Developer',
    company: 'DataCore Analytics',
    category: 'Full Stack Developer',
    location: 'Bengaluru, Karnataka',
    jobType: 'Full-time',
    salaryRange: '₹10 - ₹16 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'datacoreRecruiter',
    requiredSkills: ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'MongoDB', 'Docker'],
    description: 'Develop analytics products that combine a React frontend with Python and Node.js services. You will design MongoDB and SQL data stores, containerize services with Docker, and improve application performance.',
  },
  {
    seedKey: 'job-dba-coredb',
    title: 'Database Administrator',
    company: 'CoreDB Solutions',
    category: 'Database Developer',
    location: 'Mumbai, Maharashtra',
    jobType: 'Full-time',
    salaryRange: '₹7 - ₹12 LPA',
    experienceLevel: 'Mid-level',
    recruiterKey: 'technovaRecruiter',
    requiredSkills: ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'AWS'],
    description: 'Manage production database clusters, backups and access controls. The role covers MySQL, PostgreSQL and MongoDB administration, SQL performance tuning, and monitoring databases hosted on AWS.',
  },
  {
    seedKey: 'job-intern-brightweb',
    title: 'Web Developer Intern',
    company: 'BrightWeb Agency',
    category: 'Web Developer',
    location: 'Jaipur, Rajasthan',
    jobType: 'Internship',
    salaryRange: '₹15,000 - ₹25,000 per month',
    experienceLevel: 'Fresher',
    recruiterKey: 'technovaRecruiter',
    requiredSkills: ['HTML', 'CSS', 'JavaScript', 'Git'],
    description: 'A six-month internship for students who want practical web development experience. You will build responsive pages with HTML, CSS and JavaScript, fix bugs, and learn professional Git workflows with mentor support.',
  },
  {
    seedKey: 'job-ml-intern-insightlab',
    title: 'Machine Learning Intern',
    company: 'InsightLab Analytics',
    category: 'Machine Learning Engineer',
    location: 'Remote',
    jobType: 'Internship',
    salaryRange: '₹20,000 - ₹30,000 per month',
    experienceLevel: 'Fresher',
    recruiterKey: 'datacoreRecruiter',
    requiredSkills: ['Python', 'Machine Learning', 'Data Science', 'SQL'],
    description: 'Work with the applied AI team on real datasets. You will clean data with Python and SQL, train machine learning models, and present results to mentors. Strong data science fundamentals are more important than prior industry experience.',
  },
];

// ---------------------------------------------------------------------------
// Courses stored in MongoDB and used by the recommendation API
// ---------------------------------------------------------------------------
const SAMPLE_COURSES = [
  { seedKey: 'course-python-fcc', skill: 'Python', title: 'Scientific Computing with Python', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', description: 'Free project-based Python certification course.', level: 'Beginner' },
  { seedKey: 'course-python-coursera', skill: 'Python', title: 'Python for Everybody', platform: 'Coursera', url: 'https://www.coursera.org/specializations/python', description: 'Beginner-friendly Python specialization from the University of Michigan.', level: 'Beginner' },
  { seedKey: 'course-java-fcc', skill: 'Java', title: 'Learn Java - Free Courses', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/news/learn-java-free-java-courses-for-beginners/', description: 'Curated free Java courses for beginners.', level: 'Beginner' },
  { seedKey: 'course-java-oracle', skill: 'Java', title: 'Java Tutorials', platform: 'Oracle', url: 'https://docs.oracle.com/javase/tutorial/', description: 'Official Java language tutorials from Oracle.', level: 'All levels' },
  { seedKey: 'course-javascript-fcc', skill: 'JavaScript', title: 'JavaScript Algorithms and Data Structures', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/', description: 'Hands-on JavaScript certification with projects.', level: 'Beginner' },
  { seedKey: 'course-c-learn', skill: 'C', title: 'Learn C Programming', platform: 'Learn-C.org', url: 'https://www.learn-c.org/', description: 'Interactive C tutorial with exercises.', level: 'Beginner' },
  { seedKey: 'course-cpp-learn', skill: 'C++', title: 'Learn C++', platform: 'LearnCpp.com', url: 'https://www.learncpp.com/', description: 'A complete free C++ tutorial series.', level: 'Beginner' },
  { seedKey: 'course-html-mdn', skill: 'HTML', title: 'Structuring the Web with HTML', platform: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/HTML', description: 'MDN guide to semantic HTML.', level: 'Beginner' },
  { seedKey: 'course-css-mdn', skill: 'CSS', title: 'CSS Learning Area', platform: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/CSS', description: 'MDN guide to modern CSS layout and styling.', level: 'Beginner' },
  { seedKey: 'course-react-docs', skill: 'React', title: 'Learn React', platform: 'React Official Docs', url: 'https://react.dev/learn', description: 'Official React tutorial covering components, state and hooks.', level: 'Beginner' },
  { seedKey: 'course-react-fcc', skill: 'React', title: 'Front End Development Libraries', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/', description: 'React, Bootstrap and Redux projects.', level: 'Intermediate' },
  { seedKey: 'course-node-docs', skill: 'Node.js', title: 'Introduction to Node.js', platform: 'Node.js Official Docs', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs', description: 'Official Node.js getting-started guide.', level: 'Beginner' },
  { seedKey: 'course-express-docs', skill: 'Express.js', title: 'Express Getting Started', platform: 'Express.js Docs', url: 'https://expressjs.com/en/starter/installing.html', description: 'Build your first Express web server.', level: 'Beginner' },
  { seedKey: 'course-mongodb-university', skill: 'MongoDB', title: 'MongoDB Basics', platform: 'MongoDB University', url: 'https://learn.mongodb.com/', description: 'Free MongoDB courses and hands-on labs.', level: 'Beginner' },
  { seedKey: 'course-mysql-docs', skill: 'MySQL', title: 'MySQL Tutorial', platform: 'MySQL Documentation', url: 'https://dev.mysql.com/doc/refman/8.0/en/tutorial.html', description: 'Official MySQL beginner tutorial.', level: 'Beginner' },
  { seedKey: 'course-sql-w3', skill: 'SQL', title: 'SQL Tutorial', platform: 'W3Schools', url: 'https://www.w3schools.com/sql/', description: 'Beginner SQL tutorial with live examples.', level: 'Beginner' },
  { seedKey: 'course-sql-kaggle', skill: 'SQL', title: 'Intro to SQL', platform: 'Kaggle', url: 'https://www.kaggle.com/learn/intro-to-sql', description: 'Free interactive SQL course for data analysis.', level: 'Beginner' },
  { seedKey: 'course-postgres-tutorial', skill: 'PostgreSQL', title: 'PostgreSQL Tutorial', platform: 'PostgreSQL Tutorial', url: 'https://www.postgresqltutorial.com/', description: 'Practical PostgreSQL guide for developers.', level: 'All levels' },
  { seedKey: 'course-git-book', skill: 'Git', title: 'Pro Git Book', platform: 'Git SCM', url: 'https://git-scm.com/book/en/v2', description: 'Free official Git book.', level: 'All levels' },
  { seedKey: 'course-github-docs', skill: 'GitHub', title: 'GitHub Getting Started', platform: 'GitHub Docs', url: 'https://docs.github.com/en/get-started', description: 'Learn repositories, pull requests and collaboration.', level: 'Beginner' },
  { seedKey: 'course-aws-skillbuilder', skill: 'AWS', title: 'AWS Skill Builder', platform: 'AWS Skill Builder', url: 'https://skillbuilder.aws/', description: 'Cloud learning resources from AWS.', level: 'All levels' },
  { seedKey: 'course-docker-docs', skill: 'Docker', title: 'Docker Getting Started', platform: 'Docker Docs', url: 'https://docs.docker.com/get-started/', description: 'Official Docker getting-started documentation.', level: 'Beginner' },
  { seedKey: 'course-ml-google', skill: 'Machine Learning', title: 'Machine Learning Crash Course', platform: 'Google Developers', url: 'https://developers.google.com/machine-learning/crash-course', description: 'Free practical introduction to machine learning.', level: 'Beginner' },
  { seedKey: 'course-ml-coursera', skill: 'Machine Learning', title: 'Machine Learning Specialization', platform: 'Coursera', url: 'https://www.coursera.org/specializations/machine-learning-introduction', description: 'Andrew Ng machine learning specialization.', level: 'Beginner' },
  { seedKey: 'course-dl-deeplearning', skill: 'Deep Learning', title: 'Deep Learning Specialization', platform: 'DeepLearning.AI', url: 'https://www.deeplearning.ai/courses/deep-learning-specialization/', description: 'Neural networks, CNNs and sequence models.', level: 'Intermediate' },
  { seedKey: 'course-ds-fcc', skill: 'Data Science', title: 'Data Analysis with Python', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/', description: 'Free data analysis certification using Python.', level: 'Beginner' },
  { seedKey: 'course-powerbi-ms', skill: 'Power BI', title: 'Power BI Learning Path', platform: 'Microsoft Learn', url: 'https://learn.microsoft.com/en-us/power-bi/', description: 'Official Power BI learning documentation.', level: 'Beginner' },
  { seedKey: 'course-tableau-training', skill: 'Tableau', title: 'Tableau Free Training Videos', platform: 'Tableau', url: 'https://www.tableau.com/learn/training', description: 'Official Tableau training videos.', level: 'Beginner' },
  { seedKey: 'course-excel-exceljet', skill: 'Excel', title: 'Excel Tutorials', platform: 'Exceljet', url: 'https://exceljet.net/', description: 'Practical Excel formulas and functions.', level: 'All levels' },
  { seedKey: 'course-restfulapi', skill: 'REST API', title: 'REST API Tutorial', platform: 'RESTfulAPI.net', url: 'https://restfulapi.net/', description: 'Learn REST design principles and HTTP methods.', level: 'Beginner' },
  { seedKey: 'course-flask-docs', skill: 'Flask', title: 'Flask Tutorial', platform: 'Flask Docs', url: 'https://flask.palletsprojects.com/en/stable/tutorial/', description: 'Official Flask application tutorial.', level: 'Beginner' },
  { seedKey: 'course-django-docs', skill: 'Django', title: 'Django Tutorial', platform: 'Django Docs', url: 'https://docs.djangoproject.com/en/stable/intro/tutorial01/', description: 'Official Django first-app tutorial.', level: 'Beginner' },
  { seedKey: 'course-php-manual', skill: 'PHP', title: 'PHP Tutorial', platform: 'PHP Manual', url: 'https://www.php.net/manual/en/tutorial.php', description: 'Official PHP beginner tutorial.', level: 'Beginner' },
  { seedKey: 'course-angular-docs', skill: 'Angular', title: 'Angular Tutorials', platform: 'Angular.dev', url: 'https://angular.dev/tutorials', description: 'Official Angular tutorials.', level: 'Beginner' },
  { seedKey: 'course-typescript-docs', skill: 'TypeScript', title: 'TypeScript Handbook', platform: 'TypeScript Docs', url: 'https://www.typescriptlang.org/docs/handbook/intro.html', description: 'Official TypeScript language handbook.', level: 'Beginner' },
  { seedKey: 'course-mern-fcc', skill: 'MongoDB', title: 'MERN Stack Course', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/news/learn-the-mern-stack/', description: 'Build full stack applications with MongoDB, Express, React and Node.', level: 'Intermediate' },
];

// ---------------------------------------------------------------------------
// Resume profiles (PDF files are bundled in backend/seed/samples/)
// ---------------------------------------------------------------------------
const RESUME_PROFILES = [
  { userKey: 'demoApplicant', fileName: 'seed-ananya-sharma.pdf' },
  { userKey: 'karthik', fileName: 'seed-karthik-raman.pdf' },
  { userKey: 'neha', fileName: 'seed-neha-kapoor.pdf' },
  { userKey: 'vivek', fileName: 'seed-vivek-singh.pdf' },
  { userKey: 'fatima', fileName: 'seed-fatima-khan.pdf' },
  { userKey: 'rohan', fileName: 'seed-rohan-das.pdf' },
  { userKey: 'ishita', fileName: 'seed-ishita-bose.pdf' },
];

// Applications are seeded on past dates so they do not consume today's limit.
const SAMPLE_APPLICATIONS = [
  { userId: 'demoApplicant', jobKey: 'job-full-stack-technova', status: 'Shortlisted', daysAgo: 3 },
  { userId: 'demoApplicant', jobKey: 'job-backend-cloudsprint', status: 'Pending', daysAgo: 5 },
  { userId: 'demoApplicant', jobKey: 'job-data-analyst-insightlab', status: 'Rejected', daysAgo: 10 },
  { userId: 'karthik', jobKey: 'job-data-analyst-insightlab', status: 'Pending', daysAgo: 1 },
  { userId: 'karthik', jobKey: 'job-data-scientist-dataminds', status: 'Shortlisted', daysAgo: 4 },
  { userId: 'neha', jobKey: 'job-frontend-pixelcraft', status: 'Shortlisted', daysAgo: 2 },
  { userId: 'neha', jobKey: 'job-react-pixelcraft', status: 'Accepted', daysAgo: 7 },
  { userId: 'vivek', jobKey: 'job-backend-cloudsprint', status: 'Pending', daysAgo: 1 },
  { userId: 'vivek', jobKey: 'job-mern-cloudsprint', status: 'Accepted', daysAgo: 6 },
  { userId: 'fatima', jobKey: 'job-java-finedge', status: 'Pending', daysAgo: 2 },
  { userId: 'rohan', jobKey: 'job-python-backend-finedge', status: 'Pending', daysAgo: 1 },
  { userId: 'ishita', jobKey: 'job-data-scientist-dataminds', status: 'Shortlisted', daysAgo: 3 },
];

async function ensureUsers() {
  const users = {};

  for (const item of DEMO_USERS) {
    let user = await User.findOne({ email: item.email });

    if (!user) {
      user = new User({
        name: item.name,
        email: item.email,
        password: item.password, // hashed by the User pre-save hook
        role: item.role,
        headline: item.headline,
        location: item.location,
      });
    } else {
      user.name = item.name;
      user.role = item.role;
      user.headline = item.headline;
      user.location = item.location;
      user.password = item.password; // reset demo password on re-seed
    }

    await user.save();
    users[item.key] = user;
    console.log(`User ready: ${user.email} (${user.role})`);
  }

  return users;
}

async function ensureJobs(users) {
  const jobs = {};

  for (const item of SAMPLE_JOBS) {
    const recruiter = users[item.recruiterKey];
    const job = await Job.findOneAndUpdate(
      { seedKey: item.seedKey },
      {
        $set: {
          title: item.title,
          company: item.company,
          category: item.category,
          location: item.location,
          jobType: item.jobType,
          salaryRange: item.salaryRange,
          experienceLevel: item.experienceLevel,
          requiredSkills: normalizeSkills(item.requiredSkills),
          description: item.description,
          recruiter: recruiter._id,
          isActive: true,
          seedKey: item.seedKey,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    jobs[item.seedKey] = job;
  }

  console.log(`${Object.keys(jobs).length} sample jobs ready.`);
  return jobs;
}

async function ensureCourses() {
  for (const item of SAMPLE_COURSES) {
    await Course.findOneAndUpdate(
      { seedKey: item.seedKey },
      { $set: { ...item, isFree: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }
  console.log(`${SAMPLE_COURSES.length} courses ready.`);
}

async function ensureResumes(users) {
  const resumes = {};

  for (const profile of RESUME_PROFILES) {
    const user = users[profile.userKey];
    const samplePath = path.join(samplesDirectory, profile.fileName);

    if (!fs.existsSync(samplePath)) {
      throw new Error(`Sample resume missing: ${samplePath}`);
    }

    const destination = path.join(uploadDirectory, profile.fileName);
    fs.copyFileSync(samplePath, destination);
    const pdfBuffer = fs.readFileSync(destination);

    // Extract skills from the actual PDF so the seeded data follows the
    // same pipeline as a real applicant upload.
    const parsed = await pdfParse(pdfBuffer);
    const extractedSkills = extractSkills(parsed.text);

    let resume = await Resume.findOne({ applicant: user._id });

    if (!resume) {
      resume = new Resume({
        applicant: user._id,
        originalName: `${user.name.replace(/\s+/g, '_')}_Resume.pdf`,
        storedName: profile.fileName,
        mimeType: 'application/pdf',
        size: pdfBuffer.length,
        extractedSkills,
        manualSkills: [],
      });
    } else {
      resume.originalName = `${user.name.replace(/\s+/g, '_')}_Resume.pdf`;
      resume.storedName = profile.fileName;
      resume.mimeType = 'application/pdf';
      resume.size = pdfBuffer.length;
      resume.extractedSkills = extractedSkills;
      resume.manualSkills = [];
    }

    await resume.save();
    resumes[profile.userKey] = resume;
    console.log(`Resume ready: ${user.name} (${resume.skills.length} skills)`);
  }

  return resumes;
}

async function ensureApplications(users, jobs, resumes) {
  const dayMs = 24 * 60 * 60 * 1000;
  const applications = [];

  for (const item of SAMPLE_APPLICATIONS) {
    const applicant = users[item.userId];
    const job = jobs[item.jobKey];
    const resume = resumes[item.userId];
    const appliedAt = new Date(Date.now() - item.daysAgo * dayMs);
    const match = calculateMatch(resume.skills, job.requiredSkills);

    const statusHistory = [{ status: 'Pending', changedAt: appliedAt }];
    if (item.status !== 'Pending') {
      statusHistory.push({
        status: item.status,
        changedAt: new Date(appliedAt.getTime() + 12 * 60 * 60 * 1000),
        changedBy: job.recruiter,
      });
    }

    const application = await Application.findOneAndUpdate(
      { applicant: applicant._id, job: job._id },
      {
        $set: {
          applicant: applicant._id,
          job: job._id,
          recruiter: job.recruiter,
          status: item.status,
          matchPercentage: match.matchPercentage,
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          appliedAt,
          dateKey: getKolkataDateKey(appliedAt),
          statusHistory,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    applications.push(application);
  }

  console.log(`${applications.length} sample applications ready.`);
  return applications;
}

async function ensureNotifications(applications) {
  let created = 0;

  for (const application of applications) {
    const populated = await Application.findById(application._id)
      .populate('applicant', 'name')
      .populate('job', 'title company')
      .lean();

    const applicant = populated.applicant;
    const job = populated.job;
    if (!applicant || !job) continue;

    const applicantTitle = populated.status === 'Pending'
      ? 'Application submitted'
      : `Application ${populated.status}`;

    const applicantNotification = {
      seedKey: `seed-notification-applicant-${populated._id}`,
      user: applicant._id,
      type: populated.status === 'Pending' ? 'application_submitted' : 'application_status',
      title: applicantTitle,
      message: populated.status === 'Pending'
        ? `Your application for ${job.title} at ${job.company} was submitted. Match score: ${populated.matchPercentage}%.`
        : `Your application for ${job.title} at ${job.company} was marked as ${populated.status}.`,
      application: populated._id,
      isRead: false,
    };

    const recruiterNotification = {
      seedKey: `seed-notification-recruiter-${populated._id}`,
      user: populated.recruiter,
      type: 'new_application',
      title: 'New application received',
      message: `${applicant.name} applied for ${job.title}. Match score: ${populated.matchPercentage}%.`,
      application: populated._id,
      isRead: false,
    };

    for (const notification of [applicantNotification, recruiterNotification]) {
      const result = await Notification.updateOne(
        { seedKey: notification.seedKey },
        { $setOnInsert: notification },
        { upsert: true }
      );
      if (result.upsertedCount > 0) created += 1;
    }
  }

  console.log(`${created} new notifications created (existing ones kept).`);
}

async function main() {
  await connectDB();

  // Build indexes before writing seed records.
  await Promise.all([
    User.init(),
    Job.init(),
    Resume.init(),
    Application.init(),
    Course.init(),
    Notification.init(),
  ]);

  console.log('\nSeeding Job Skill Matcher database...\n');

  const users = await ensureUsers();
  const jobs = await ensureJobs(users);
  await ensureCourses();
  const resumes = await ensureResumes(users);
  const applications = await ensureApplications(users, jobs, resumes);
  await ensureNotifications(applications);

  console.log('\nSeed completed successfully.');
  console.log('Applicant login: applicant@demo.com / Applicant@123');
  console.log('Recruiter login: recruiter@demo.com / Recruiter@123');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
