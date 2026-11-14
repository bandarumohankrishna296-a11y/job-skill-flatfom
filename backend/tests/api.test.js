// tests/api.test.js
// End-to-end API tests for the Job Skill Matcher Platform.
//
// Run with:  npm test
// Requirement: the backend must already be running on http://localhost:5000
// and MongoDB must be available. The tests create temporary users/jobs and
// clean them up again when they finish.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 5000}`;
const RUN_ID = Date.now();
const PASSWORD = 'TestPass123';

const TEST_EMAILS = {
  applicant: `test.applicant.${RUN_ID}@example.com`,
  limitApplicant: `test.limit.${RUN_ID}@example.com`,
  recruiter: `test.recruiter.${RUN_ID}@example.com`,
  otherRecruiter: `test.other.${RUN_ID}@example.com`,
};

const state = {
  tokens: {},
  users: {},
  jobId: null,
  applicationId: null,
  resumeId: null,
  createdUserIds: [],
};

const results = [];

/* ---------------------------------------------------------------------------
 * Small HTTP helpers
 * ------------------------------------------------------------------------ */
async function request(method, endpoint, options = {}) {
  const { token, body, formData } = options;
  const headers = {};
  let payload;

  if (token) headers.Authorization = `Bearer ${token}`;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body: payload });
  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = Buffer.from(await response.arrayBuffer());
  }

  return { status: response.status, data, headers: response.headers };
}

function expectStatus(response, expected, label) {
  assert.strictEqual(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${response.status} (${JSON.stringify(response.data).slice(0, 300)})`
  );
}

async function run(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error(`  FAIL  ${name}`);
    console.error(`        ${error.message}`);
  }
}

/* ---------------------------------------------------------------------------
 * Minimal DOCX generator (ZIP with stored entries + word/document.xml).
 * This keeps the test dependency-free while exercising the real mammoth path.
 * ------------------------------------------------------------------------ */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function createTestDocx() {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Test Candidate</w:t></w:r></w:p>
    <w:p><w:r><w:t>Skills: Python, React, SQL, Docker, Git, JavaScript, MongoDB</w:t></w:r></w:p>
    <w:p><w:r><w:t>Education: B.Tech Artificial Intelligence and Data Science</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: relationships },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

function fileFormData(buffer, filename, mimeType) {
  const formData = new FormData();
  formData.append('resume', new Blob([buffer], { type: mimeType }), filename);
  return formData;
}

/* ---------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------ */
async function registerUser(key, name, role) {
  const response = await request('POST', '/api/auth/register', {
    body: {
      name,
      email: TEST_EMAILS[key],
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role,
    },
  });
  expectStatus(response, 201, `register ${role}`);
  assert.ok(response.data.token, 'Registration should return a JWT token.');
  state.tokens[key] = response.data.token;
  state.users[key] = response.data.user;
  state.createdUserIds.push(response.data.user.id);
}

async function main() {
  console.log(`\nJob Skill Matcher API tests`);
  console.log(`API: ${BASE_URL}`);
  console.log(`Temporary test run: ${RUN_ID}\n`);

  // Make sure the API is reachable before running the suite.
  try {
    const health = await request('GET', '/api/health');
    expectStatus(health, 200, 'health check');
    assert.strictEqual(health.data.database, 'connected', 'MongoDB should be connected.');
  } catch (error) {
    console.error('The backend is not reachable. Start it with "npm start" first.');
    console.error(error.message);
    process.exit(1);
  }

  console.log('Authentication');
  await run('rejects an invalid login', async () => {
    const response = await request('POST', '/api/auth/login', {
      body: { email: TEST_EMAILS.applicant, password: 'WrongPass123' },
    });
    expectStatus(response, 401, 'invalid login');
  });

  await run('rejects a weak password during registration', async () => {
    const response = await request('POST', '/api/auth/register', {
      body: {
        name: 'Weak Password',
        email: `weak.${RUN_ID}@example.com`,
        password: 'short',
        confirmPassword: 'short',
        role: 'applicant',
      },
    });
    expectStatus(response, 400, 'weak password');
  });

  await run('registers a temporary applicant, two recruiters and a limit-test applicant', async () => {
    await registerUser('applicant', 'Test Flow Applicant', 'applicant');
    await registerUser('limitApplicant', 'Test Limit Applicant', 'applicant');
    await registerUser('recruiter', 'Test Recruiter One', 'recruiter');
    await registerUser('otherRecruiter', 'Test Recruiter Two', 'recruiter');
  });

  await run('prevents duplicate email registration', async () => {
    const response = await request('POST', '/api/auth/register', {
      body: {
        name: 'Duplicate Applicant',
        email: TEST_EMAILS.applicant,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        role: 'applicant',
      },
    });
    expectStatus(response, 409, 'duplicate email');
  });

  await run('returns the current user from /auth/me', async () => {
    const response = await request('GET', '/api/auth/me', { token: state.tokens.applicant });
    expectStatus(response, 200, '/auth/me');
    assert.strictEqual(response.data.user.email, TEST_EMAILS.applicant);
  });

  await run('rejects a malformed JWT', async () => {
    const response = await request('GET', '/api/auth/me', { token: 'not-a-real-token' });
    expectStatus(response, 401, 'malformed token');
  });

  await run('rejects applicant access to recruiter APIs', async () => {
    const response = await request('GET', '/api/recruiter/dashboard', { token: state.tokens.applicant });
    expectStatus(response, 403, 'role protection');
  });

  console.log('\nResume upload and skill extraction');
  await run('uploads a PDF resume and extracts skills', async () => {
    const pdfPath = path.join(__dirname, '..', 'seed', 'samples', 'seed-ananya-sharma.pdf');
    assert.ok(fs.existsSync(pdfPath), 'Seed PDF sample should exist.');
    const formData = fileFormData(fs.readFileSync(pdfPath), 'test-resume.pdf', 'application/pdf');

    const response = await request('POST', '/api/resumes/upload', {
      token: state.tokens.applicant,
      formData,
    });
    expectStatus(response, 201, 'PDF upload');
    assert.strictEqual(response.data.hasResume, true);
    assert.ok(Array.isArray(response.data.resume.extractedSkills));
    assert.ok(response.data.resume.extractedSkills.length > 0, 'PDF should produce extracted skills.');
    state.resumeId = response.data.resume.id;
  });

  await run('uploads a DOCX resume and replaces the previous file', async () => {
    const docx = createTestDocx();
    const formData = fileFormData(
      docx,
      'test-resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const response = await request('POST', '/api/resumes/upload', {
      token: state.tokens.applicant,
      formData,
    });
    expectStatus(response, 201, 'DOCX upload');
    const skills = response.data.resume.extractedSkills.map((skill) => skill.toLowerCase());
    for (const expected of ['python', 'react', 'sql', 'docker', 'git']) {
      assert.ok(skills.includes(expected), `DOCX extraction should include ${expected}.`);
    }
    assert.strictEqual(response.data.resume.originalName, 'test-resume.docx');
    state.resumeId = response.data.resume.id;
  });

  await run('rejects an unsupported file type', async () => {
    const formData = fileFormData(Buffer.from('Python, React, SQL'), 'resume.txt', 'text/plain');
    const response = await request('POST', '/api/resumes/upload', {
      token: state.tokens.applicant,
      formData,
    });
    expectStatus(response, 400, 'invalid file type');
  });

  await run('returns resume metadata and supports manual skills', async () => {
    const mine = await request('GET', '/api/resumes/my-resume', { token: state.tokens.applicant });
    expectStatus(mine, 200, 'my-resume');
    assert.strictEqual(mine.data.hasResume, true);

    const update = await request('PATCH', '/api/resumes/skills', {
      token: state.tokens.applicant,
      body: { manualSkills: ['Docker', 'Communication'] },
    });
    expectStatus(update, 200, 'manual skills update');
    assert.ok(update.data.skills.includes('Docker'), 'Manual skill should be included in the combined list.');
  });

  console.log('\nRecruiter job management');
  await run('creates a job as the owner recruiter', async () => {
    const response = await request('POST', '/api/jobs', {
      token: state.tokens.recruiter,
      body: {
        title: `API Test Full Stack Developer ${RUN_ID}`,
        company: 'Test Company',
        description: 'A temporary job created by the automated API test suite to verify recruiter job management.',
        location: 'Chennai, Tamil Nadu',
        salaryRange: '₹6 - ₹9 LPA',
        category: 'Full Stack Developer',
        jobType: 'Full-time',
        experienceLevel: 'Fresher',
        requiredSkills: ['Python', 'React', 'SQL', 'Docker', 'Git'],
      },
    });
    expectStatus(response, 201, 'create job');
    state.jobId = response.data.data._id;
  });

  await run('blocks another recruiter from editing the job', async () => {
    const response = await request('PUT', `/api/jobs/${state.jobId}`, {
      token: state.tokens.otherRecruiter,
      body: { title: 'Hijacked title' },
    });
    expectStatus(response, 403, 'job ownership update');
  });

  await run('blocks another recruiter from deleting the job', async () => {
    const response = await request('DELETE', `/api/jobs/${state.jobId}`, {
      token: state.tokens.otherRecruiter,
    });
    expectStatus(response, 403, 'job ownership delete');
  });

  await run('updates the job as the owner', async () => {
    const response = await request('PUT', `/api/jobs/${state.jobId}`, {
      token: state.tokens.recruiter,
      body: { salaryRange: '₹7 - ₹10 LPA' },
    });
    expectStatus(response, 200, 'update job');
    assert.strictEqual(response.data.data.salaryRange, '₹7 - ₹10 LPA');
  });

  console.log('\nMatching, applications and limits');
  await run('calculates a live match on job details', async () => {
    const response = await request('GET', `/api/jobs/${state.jobId}`, { token: state.tokens.applicant });
    expectStatus(response, 200, 'job details');
    assert.ok(response.data.data.match, 'Applicant job details should include match data.');
    assert.ok(Array.isArray(response.data.data.match.matchedSkills));
    assert.ok(Array.isArray(response.data.data.match.missingSkills));
    assert.strictEqual(response.data.data.hasApplied, false);
  });

  await run('returns course recommendations for missing skills', async () => {
    const response = await request('GET', `/api/courses/recommendations/${state.jobId}`, {
      token: state.tokens.applicant,
    });
    expectStatus(response, 200, 'course recommendations');
    assert.ok(Array.isArray(response.data.recommendations.missingSkills));
    assert.ok(Array.isArray(response.data.recommendations.courses));
    assert.ok(Array.isArray(response.data.recommendations.searchLinks));
  });

  await run('submits an application', async () => {
    const response = await request('POST', `/api/applications/apply/${state.jobId}`, {
      token: state.tokens.applicant,
    });
    expectStatus(response, 201, 'apply');
    assert.ok(response.data.data.id);
    assert.ok(typeof response.data.data.matchPercentage === 'number');
    state.applicationId = response.data.data.id;
  });

  await run('prevents a duplicate application', async () => {
    const response = await request('POST', `/api/applications/apply/${state.jobId}`, {
      token: state.tokens.applicant,
    });
    expectStatus(response, 409, 'duplicate application');
  });

  await run('returns application tracking with status counts and daily limit', async () => {
    const response = await request('GET', '/api/applications/my-applications?page=1&limit=10', {
      token: state.tokens.applicant,
    });
    expectStatus(response, 200, 'my applications');
    assert.ok(response.data.data.length >= 1);
    assert.ok(response.data.statusCounts);
    assert.strictEqual(response.data.dailyLimit.limit, 10);
    assert.ok(response.data.dailyLimit.used >= 1);
  });

  await run('enforces the 10-per-day limit under concurrent requests', async () => {
    const jobs = await request('GET', '/api/jobs?page=1&limit=20');
    expectStatus(jobs, 200, 'job list for limit test');
    const jobIds = jobs.data.data.slice(0, 12).map((job) => job._id);
    assert.ok(jobIds.length >= 12, 'At least 12 jobs are needed for the concurrency test.');

    const responses = await Promise.all(
      jobIds.map((jobId) => request('POST', `/api/applications/apply/${jobId}`, {
        token: state.tokens.limitApplicant,
      }))
    );

    const created = responses.filter((response) => response.status === 201).length;
    const limited = responses.filter((response) => response.status === 429).length;
    assert.strictEqual(created, 10, `Exactly 10 applications should succeed, but ${created} succeeded.`);
    assert.strictEqual(limited, 2, `Exactly 2 requests should be rate limited, but ${limited} were.`);

    const tracking = await request('GET', '/api/applications/my-applications?page=1&limit=1', {
      token: state.tokens.limitApplicant,
    });
    expectStatus(tracking, 200, 'limit applicant tracking');
    assert.strictEqual(tracking.data.dailyLimit.used, 10, 'The counter must not exceed 10.');
    assert.strictEqual(tracking.data.dailyLimit.remaining, 0);
  });

  console.log('\nRecruiter candidate search and status updates');
  await run('returns the recruiter dashboard statistics', async () => {
    const response = await request('GET', '/api/recruiter/dashboard', { token: state.tokens.recruiter });
    expectStatus(response, 200, 'recruiter dashboard');
    assert.ok(response.data.data.stats.totalApplications >= 1);
  });

  await run('searches candidates by keyword and job match', async () => {
    const response = await request(
      'GET',
      `/api/recruiter/candidates?q=${encodeURIComponent('Test Flow Applicant')}&jobId=${state.jobId}&page=1&limit=5`,
      { token: state.tokens.recruiter }
    );
    expectStatus(response, 200, 'candidate search');
    assert.ok(response.data.pagination.total >= 1, 'The applicant should be found.');
    assert.ok(response.data.selectedJob, 'The selected job should be returned.');
    assert.ok(typeof response.data.data[0].matchPercentage === 'number');
  });

  await run('shows candidate details only to a recruiter with an application', async () => {
    const allowed = await request(`GET`, `/api/recruiter/candidates/${state.users.applicant.id}`, {
      token: state.tokens.recruiter,
    });
    expectStatus(allowed, 200, 'candidate details');

    const denied = await request(`GET`, `/api/recruiter/candidates/${state.users.applicant.id}`, {
      token: state.tokens.otherRecruiter,
    });
    expectStatus(denied, 403, 'candidate privacy');
  });

  await run('downloads the resume for the owner and the related recruiter only', async () => {
    const owner = await request('GET', `/api/resumes/${state.resumeId}/download`, {
      token: state.tokens.applicant,
    });
    expectStatus(owner, 200, 'owner resume download');

    const relatedRecruiter = await request('GET', `/api/resumes/${state.resumeId}/download`, {
      token: state.tokens.recruiter,
    });
    expectStatus(relatedRecruiter, 200, 'recruiter resume download');

    const unrelatedRecruiter = await request('GET', `/api/resumes/${state.resumeId}/download`, {
      token: state.tokens.otherRecruiter,
    });
    expectStatus(unrelatedRecruiter, 403, 'unrelated recruiter download');
  });

  await run('updates application status and notifies the applicant', async () => {
    const update = await request('PATCH', `/api/applications/${state.applicationId}/status`, {
      token: state.tokens.recruiter,
      body: { status: 'Shortlisted' },
    });
    expectStatus(update, 200, 'status update');
    assert.strictEqual(update.data.data.status, 'Shortlisted');

    const tracking = await request('GET', '/api/applications/my-applications?page=1&limit=10', {
      token: state.tokens.applicant,
    });
    const application = tracking.data.data.find((item) => String(item._id) === String(state.applicationId));
    assert.ok(application, 'The application should still be visible.');
    assert.strictEqual(application.status, 'Shortlisted');

    const notifications = await request('GET', '/api/notifications?limit=10', {
      token: state.tokens.applicant,
    });
    expectStatus(notifications, 200, 'notifications');
    assert.ok(
      notifications.data.data.some((item) => item.type === 'application_status'),
      'The applicant should receive a status notification.'
    );
  });

  await run('blocks an unrelated recruiter from changing application status', async () => {
    const response = await request('PATCH', `/api/applications/${state.applicationId}/status`, {
      token: state.tokens.otherRecruiter,
      body: { status: 'Rejected' },
    });
    expectStatus(response, 403, 'status authorization');
  });

  console.log('\nJob deletion');
  await run('soft-deletes the job as the owner', async () => {
    const response = await request('DELETE', `/api/jobs/${state.jobId}`, {
      token: state.tokens.recruiter,
    });
    expectStatus(response, 200, 'delete job');

    const publicView = await request('GET', `/api/jobs/${state.jobId}`);
    expectStatus(publicView, 404, 'deleted job hidden from the public');
  });
}

/* ---------------------------------------------------------------------------
 * Cleanup
 * ------------------------------------------------------------------------ */
async function cleanup() {
  if (state.createdUserIds.length === 0) return;

  try {
    const User = require('../models/User');
    const Job = require('../models/Job');
    const Resume = require('../models/Resume');
    const Application = require('../models/Application');
    const Notification = require('../models/Notification');
    const DailyApplicationCounter = require('../models/DailyApplicationCounter');

    await mongoose.connect(process.env.MONGO_URI);

    const resumes = await Resume.find({ applicant: { $in: state.createdUserIds } }).lean();
    for (const resume of resumes) {
      const filePath = path.join(__dirname, '..', 'uploads', 'resumes', path.basename(resume.storedName));
      fs.promises.unlink(filePath).catch(() => {});
    }

    // The concurrency test applies to seeded jobs, which creates "new application"
    // notifications for demo recruiters. Collect the temporary application IDs
    // first so those notifications are removed too.
    const testApplications = await Application.find({
      $or: [
        { applicant: { $in: state.createdUserIds } },
        { recruiter: { $in: state.createdUserIds } },
      ],
    })
      .select('_id')
      .lean();
    const applicationIds = testApplications.map((application) => application._id);

    await Promise.all([
      Resume.deleteMany({ applicant: { $in: state.createdUserIds } }),
      Application.deleteMany({ _id: { $in: applicationIds } }),
      Job.deleteMany({ recruiter: { $in: state.createdUserIds } }),
      Notification.deleteMany({
        $or: [
          { user: { $in: state.createdUserIds } },
          { application: { $in: applicationIds } },
        ],
      }),
      DailyApplicationCounter.deleteMany({ applicant: { $in: state.createdUserIds } }),
      User.deleteMany({ _id: { $in: state.createdUserIds } }),
    ]);

    console.log('\nTemporary test data cleaned up.');
  } catch (error) {
    console.error(`Cleanup warning: ${error.message}`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error('\nUnexpected test error:', error);
    results.push({ name: 'Unexpected test error', ok: false, error: error.message });
  })
  .finally(async () => {
    await cleanup();

    const passed = results.filter((result) => result.ok).length;
    const failed = results.length - passed;

    console.log('\n--------------------------------------------------');
    console.log(`Tests passed: ${passed}`);
    console.log(`Tests failed: ${failed}`);
    console.log('--------------------------------------------------');

    if (failed > 0) process.exitCode = 1;
  });
