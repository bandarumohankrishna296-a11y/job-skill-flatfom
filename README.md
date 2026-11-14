# Job Skill Matcher Platform

A full-stack academic project (Full Stack Development) that compares an applicant's resume skills with the skills required by a job, shows a match percentage, highlights missing skills, recommends free courses, and lets applicants apply while recruiters manage jobs and candidates.

Built with **HTML5, CSS3, vanilla JavaScript and the Fetch API** on the frontend, and **Node.js, Express.js, MongoDB and Mongoose** on the backend. No frontend framework and no build step.

---

## Table of Contents

1. [Demo Credentials](#demo-credentials)
2. [Problem Statement](#problem-statement)
3. [Objectives](#objectives)
4. [Features](#features)
5. [Technology Stack](#technology-stack)
6. [How the Application Works](#how-the-application-works)
7. [Folder Structure](#folder-structure)
8. [Database Design](#database-design)
9. [REST API Reference](#rest-api-reference)
10. [Core Logic Explained](#core-logic-explained)
11. [Prerequisites](#prerequisites)
12. [Installation (PowerShell)](#installation-powershell)
13. [MongoDB Setup](#mongodb-setup)
14. [Running the Application](#running-the-application)
15. [Seed / Demo Data](#seed--demo-data)
16. [Testing](#testing)
17. [Screenshots](#screenshots)
18. [Security Notes](#security-notes)
19. [Limitations](#limitations)
20. [Future Enhancements](#future-enhancements)
21. [Troubleshooting](#troubleshooting)
22. [Academic Notes](#academic-notes)

---

## Demo Credentials

| Role | Email | Password |
| --- | --- | --- |
| Applicant | `applicant@demo.com` | `Applicant@123` |
| Recruiter | `recruiter@demo.com` | `Recruiter@123` |
| Recruiter (TechNova) | `hr@technova.com` | `Recruiter@123` |
| Recruiter (DataCore) | `hiring@datacore.com` | `Recruiter@123` |

Additional seeded applicants (all use `Applicant@123`):
`karthik@demo.com`, `neha@demo.com`, `vivek@demo.com`, `fatima@demo.com`, `rohan@demo.com`, `ishita@demo.com`.

The login page also has **one-click demo login buttons** for the applicant and recruiter accounts.

---

## Problem Statement

Students and freshers often apply to jobs without knowing how well their current skills match the role. Job descriptions list many required skills, and manually comparing a resume against every posting is slow and error-prone. Recruiters also need a simple way to post jobs, filter candidates by skill match, and manage applications.

This project solves that by extracting skills from an uploaded resume, computing an explainable match score for every job, showing exactly which skills are matched and which are missing, and recommending free courses for the missing skills.

---

## Objectives

- Provide secure role-based authentication for **applicants** and **recruiters**.
- Extract skills automatically from a PDF or DOCX resume.
- Let applicants review, add and remove skills manually.
- Calculate a transparent, reproducible skill match percentage per job.
- Visualize match results with a circular progress ring and green/red skill chips.
- Recommend free courses for missing skills.
- Allow applications with duplicate prevention and a strict **10 applications per day** limit (Asia/Kolkata day).
- Let recruiters create, edit, close and reopen their own job postings.
- Let recruiters search candidates, filter by job match, view applicant details and download resumes only when authorized.
- Provide live, database-driven dashboards with charts and notifications.
- Keep the codebase beginner-friendly, explainable and runnable on a local machine.

---

## Features

### Applicant

- Register and log in with JWT authentication.
- Upload a **PDF or DOCX** resume (maximum **5 MB**).
- Automatic keyword-based skill extraction with aliases (for example `react.js` → `React`, `postgres` → `PostgreSQL`).
- Edit skills: remove extracted skills, add manual skills, or start fresh.
- Browse and filter jobs by keyword, location, category, job type, experience level and skills.
- Sort jobs by newest, oldest, title or **best skill match**.
- Job details page with:
  - Circular match percentage ring.
  - **Green** matched-skill chips and **red** missing-skill chips.
  - Matched / required / missing skill counts.
  - Free course recommendations and search links for missing skills.
  - Apply button with duplicate-application detection.
- Application tracking with status filters (`Pending`, `Shortlisted`, `Accepted`, `Rejected`).
- Daily application limit indicator (`used / 10`, remaining, reset at midnight IST).
- Applicant dashboard with real statistics:
  - Average match, matching jobs, total applications.
  - Top job matches.
  - Recent applications.
  - Status distribution chart (Chart.js, live data).
  - Resume status and remaining daily applications.
- Profile page for name, headline, location and resume management.
- In-app notifications when an application is submitted or its status changes.

### Recruiter

- Recruiter dashboard with live statistics:
  - Total jobs, applicants, applications.
  - Pending / shortlisted / accepted / rejected counts.
  - Application status doughnut chart.
  - Recent applications and top jobs.
- Job management (create, read, update, soft delete/reopen) with **ownership protection**.
- Job form with category, type, experience level, salary range and skill picker.
- Candidate search:
  - Keyword search across name, email, headline and skills.
  - Optional job selection to compute each candidate's match percentage.
  - Pagination.
- Applicant management:
  - View candidate profile and extracted skills.
  - View applications for the recruiter's own jobs.
  - Download a candidate resume **only** when the recruiter owns a job the candidate applied to.
  - Update application status (`Pending` → `Shortlisted` / `Accepted` / `Rejected`).
- Closing a job is a **soft delete** (`isActive: false`), so applications and history are preserved.

### Security and Data Integrity

- Passwords hashed with **bcryptjs** (salt rounds) and never returned by queries.
- JWT bearer tokens with configurable expiry (`7d` by default).
- Role middleware (`applicantOnly`, `recruiterOnly`) on protected routes.
- Duplicate email prevention at validation and database level.
- Job ownership checks on update/delete and on recruiter application actions.
- Resume download authorization: the owner, or a recruiter who has an application relationship with that applicant.
- Resume upload restricted by extension, MIME type and 5 MB size.
- Input validation and text sanitization on all write endpoints.
- Atomic daily-limit counters using MongoDB `$inc` (safe under concurrent requests).
- Unique compound index prevents the same applicant from applying to the same job twice.
- One active resume per applicant (`unique` index on `applicant`).

### UI / UX

- Responsive layout for desktop, tablet and mobile.
- Sidebar workspace for logged-in users; public header for guest pages.
- Locally vendored **Font Awesome** icons and **Chart.js** — no CDN needed at runtime.
- Toast messages, inline form alerts, loading spinners, empty states and pagination.
- Accessible labels, keyboard-friendly forms and focus styles.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend markup | HTML5 |
| Frontend styling | CSS3 (custom properties, Flexbox, Grid, media queries) |
| Frontend logic | Vanilla JavaScript (ES2017+), Fetch API |
| Charts | Chart.js (vendored locally) |
| Icons | Font Awesome Free (vendored locally) |
| Runtime | Node.js 18+ (tested on Node.js 24) |
| Backend framework | Express.js 4 |
| Database | MongoDB 6+ (tested on MongoDB 8.3) |
| ODM | Mongoose 8 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| File upload | `multer` |
| PDF parsing | `pdf-parse` |
| DOCX parsing | `mammoth` |
| CORS | `cors` |
| Environment | `dotenv` |

No React, Angular, Vue, Bootstrap or Tailwind is used.

---

## How the Application Works

```
┌──────────────────────┐        HTTP/JSON + JWT        ┌──────────────────────┐
│  Browser (port 5500) │  ──────────────────────────▶  │  Express API (5000)  │
│  HTML/CSS/JS         │  ◀──────────────────────────  │  Routes/Controllers  │
└──────────────────────┘        Fetch API              └──────────┬───────────┘
                                                                  │ Mongoose
                                                                  ▼
                                                       ┌──────────────────────┐
                                                       │ MongoDB (27017)      │
                                                       │ job_skill_matcher    │
                                                       └──────────────────────┘
```

1. The browser loads static files from the frontend server on port **5500**.
2. `js/api.js` sends requests to `http://localhost:5000/api` (or same-origin when the frontend is served by Express on port 5000).
3. The JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>`.
4. Express validates the token, checks the role, runs the controller and reads/writes MongoDB through Mongoose.
5. JSON responses are rendered by page-specific scripts (`auth.js`, `jobs.js`, `applicant.js`, `recruiter.js`, `resume.js`, `notifications.js`).

The backend can also serve the frontend itself at `http://localhost:5000`, but running the two servers separately is recommended because it mirrors a real frontend/backend split.

---

## Folder Structure

```text
C:\job-skill-matcher\
├── .gitignore
├── README.md
├── docs\
│   └── screenshots\             # add your own project screenshots here
├── backend\
│   ├── .env                     # local secrets (ignored by git)
│   ├── .env.example             # environment template
│   ├── package.json
│   ├── server.js                # Express entry point + optional static hosting
│   ├── config\
│   │   └── db.js                # Mongoose connection
│   ├── controllers\
│   │   ├── applicantController.js
│   │   ├── applicationController.js
│   │   ├── authController.js
│   │   ├── courseController.js
│   │   ├── jobController.js
│   │   ├── notificationController.js
│   │   ├── recruiterController.js
│   │   └── resumeController.js
│   ├── middleware\
│   │   ├── authMiddleware.js    # protect / optionalAuth
│   │   ├── errorMiddleware.js   # 404 + central error handler
│   │   ├── roleMiddleware.js    # applicantOnly / recruiterOnly
│   │   └── uploadMiddleware.js  # multer config, 5 MB limit, PDF/DOCX filter
│   ├── models\
│   │   ├── Application.js
│   │   ├── Course.js
│   │   ├── DailyApplicationCounter.js
│   │   ├── Job.js
│   │   ├── Notification.js
│   │   ├── Resume.js
│   │   └── User.js
│   ├── routes\
│   │   ├── applicantRoutes.js
│   │   ├── applicationRoutes.js
│   │   ├── authRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── jobRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── recruiterRoutes.js
│   │   └── resumeRoutes.js
│   ├── seed\
│   │   ├── seedData.js          # idempotent demo data
│   │   └── samples\             # sample PDF resumes (tracked in git)
│   ├── tests\
│   │   └── api.test.js          # 28 end-to-end API tests
│   ├── uploads\
│   │   └── resumes\             # private uploaded files (ignored by git)
│   └── utils\
│       ├── courseRecommender.js
│       ├── dateUtils.js         # Asia/Kolkata date keys
│       ├── matchCalculator.js
│       ├── notificationHelper.js
│       ├── skillExtractor.js
│       └── validators.js
└── frontend\
    ├── server.js                # tiny static server (port 5500)
    ├── index.html               # landing page
    ├── login.html
    ├── register.html
    ├── jobs.html                # job listing
    ├── job-details.html         # job details, match, apply, courses
    ├── applicant-dashboard.html
    ├── profile.html             # profile + resume + skills
    ├── applications.html        # application tracking
    ├── recruiter-dashboard.html # overview, jobs, candidates, applications tabs
    ├── css\
    │   ├── style.css            # shared/public styles
    │   ├── dashboard.css        # workspace styles
    │   └── responsive.css       # media queries
    ├── js\
    │   ├── api.js               # API wrapper, session, UI helpers
    │   ├── auth.js              # login/register/logout/page guards/profile
    │   ├── notifications.js     # notification bell
    │   ├── resume.js            # upload/download/delete/skills editor
    │   ├── jobs.js              # job listing + details
    │   ├── applicant.js         # applicant dashboard/profile/applications
    │   └── recruiter.js         # recruiter dashboard and tabs
    └── vendor\
        ├── chart.umd.min.js
        └── fontawesome\
```

---

## Database Design

Database name: **`job_skill_matcher`** (configurable through `MONGO_URI`).

### `users`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String | 2–80 characters |
| `email` | String | unique, lowercase, validated |
| `password` | String | bcrypt hash, `select: false` |
| `role` | String | `applicant` or `recruiter` |
| `headline` | String | optional |
| `location` | String | optional |
| `createdAt` / `updatedAt` | Date | timestamps |

### `jobs`

| Field | Type | Notes |
| --- | --- | --- |
| `title`, `company`, `description`, `location` | String | required |
| `jobType` | String | Full-time, Part-time, Internship, Contract, Remote |
| `experienceLevel` | String | Fresher, Junior, Mid-level, Senior |
| `category` | String | e.g. Full Stack Developer, Data Analyst |
| `salaryRange` | String | optional text |
| `requiredSkills` | [String] | used for matching |
| `recruiter` | ObjectId → User | owner |
| `isActive` | Boolean | `false` = soft deleted |
| `seedKey` | String | unique sparse key used by the seed script |

### `resumes`

| Field | Type | Notes |
| --- | --- | --- |
| `applicant` | ObjectId → User | **unique**, one active resume per applicant |
| `originalName` | String | original upload filename |
| `storedName` | String | generated filename on disk |
| `mimeType`, `size` | String / Number | metadata |
| `extractedSkills` | [String] | from PDF/DOCX text |
| `manualSkills` | [String] | added by the applicant |
| `skills` | [String] | combined list used for matching (kept in sync) |
| `uploadedAt` | Date | shown in the UI |

### `applications`

| Field | Type | Notes |
| --- | --- | --- |
| `applicant` | ObjectId → User | |
| `job` | ObjectId → Job | |
| `recruiter` | ObjectId → User | copied from the job for fast dashboard queries |
| `status` | String | Pending / Shortlisted / Accepted / Rejected |
| `matchPercentage` | Number | snapshot at apply time |
| `matchedSkills`, `missingSkills` | [String] | snapshot at apply time |
| `dateKey` | String | `YYYY-MM-DD` in Asia/Kolkata |
| `statusHistory` | Array | `{ status, changedAt, changedBy }` |
| `appliedAt` | Date | |

Indexes: unique compound index on `(applicant, job)` prevents duplicates; additional indexes support status and recruiter queries.

### `dailyapplicationcounters`

| Field | Type | Notes |
| --- | --- | --- |
| `applicant` | ObjectId → User | |
| `dateKey` | String | `YYYY-MM-DD` in Asia/Kolkata |
| `count` | Number | applications reserved today |

Unique compound index on `(applicant, dateKey)`. One document per applicant per day.

### `courses`

| Field | Type | Notes |
| --- | --- | --- |
| `title`, `platform`, `skill`, `url` | String | required |
| `description` | String | optional |
| `level` | String | Beginner / Intermediate / Advanced / All levels |
| `isFree` | Boolean | demo data is free |
| `seedKey` | String | unique sparse key |

### `notifications`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User | recipient |
| `type` | String | application_submitted, application_status, new_application, system |
| `title`, `message` | String | |
| `application` | ObjectId → Application | optional link |
| `isRead` | Boolean | |
| `seedKey` | String | used by the seed script only |

### Relationships

```
User (applicant) 1 ──── 1 Resume
User (applicant) 1 ──── * Application * ──── 1 Job
User (recruiter) 1 ──── * Job
User (recruiter) 1 ──── * Application (via job ownership)
User             1 ──── * Notification
Job              1 ──── * Course recommendations (by skill name, not a hard FK)
```

---

## REST API Reference

Base URL: `http://localhost:5000/api`

All protected routes require:

```http
Authorization: Bearer <jwt-token>
```

Response shape is consistently `{ success, message?, data?, pagination? }`.

### Health

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | API status, DB connection, daily-limit timezone |

### Authentication

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register applicant or recruiter |
| POST | `/auth/login` | Public | Log in and receive a JWT |
| GET | `/auth/me` | Authenticated | Current user |
| PATCH | `/auth/profile` | Authenticated | Update name, headline, location |

### Jobs

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/jobs` | Public (optional auth) | List/filter jobs; adds match data for applicants |
| GET | `/jobs/matches` | Applicant | Jobs sorted/filtered with computed match percentage |
| GET | `/jobs/:id` | Public (optional auth) | Job details + match + `hasApplied` + owner info |
| POST | `/jobs` | Recruiter | Create a job (owner = current recruiter) |
| PUT | `/jobs/:id` | Recruiter owner | Update a job, or reopen with `{ "isActive": true }` |
| DELETE | `/jobs/:id` | Recruiter owner | Soft delete (`isActive: false`) |

Supported job query parameters: `q`, `location`, `category`, `jobType`, `experienceLevel`, `skills` (comma separated), `sort` (`newest`, `oldest`, `title`, `match`), `page`, `limit`.

### Resumes

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/resumes/upload` | Applicant | Upload PDF/DOCX (`multipart/form-data`, field name `resume`) |
| GET | `/resumes/my-resume` | Applicant | Resume metadata + skills |
| GET | `/resumes/skills` | Applicant | Combined skill list |
| PATCH | `/resumes/skills` | Applicant | Update `manualSkills` and/or `extractedSkills` |
| GET | `/resumes/:id/download` | Owner or related recruiter | Download the private file |
| DELETE | `/resumes/:id` | Applicant owner | Delete resume and file |

### Applications

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/applications/apply/:jobId` | Applicant | Apply; enforces duplicate + 10/day limit |
| GET | `/applications/my-applications` | Applicant | Tracking with status counts and daily-limit info |
| GET | `/applications/job/:jobId` | Recruiter owner | Applications for one owned job |
| PATCH | `/applications/:id/status` | Recruiter owner | Update status and notify the applicant |

`GET /applications/my-applications` accepts `status`, `page`, `limit`.

### Recruiter

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/recruiter/dashboard` | Recruiter | Stats, status counts, recent applications, top jobs |
| GET | `/recruiter/candidates` | Recruiter | Search candidates (`q`, `skill`, `jobId`, `page`, `limit`) |
| GET | `/recruiter/candidates/:applicantId` | Recruiter with application relationship | Candidate details |
| GET | `/recruiter/jobs` | Recruiter | Own jobs with application counts |
| GET | `/recruiter/applications` | Recruiter | Own applications (`jobId`, `status`, `page`, `limit`) |

### Applicant Dashboard

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/applicant/dashboard` | Applicant | Stats, top matches, recent applications, daily limit |

### Courses

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/courses` | Public | List courses (`skill`, `q`, `page`, `limit`) |
| GET | `/courses/recommendations` | Authenticated | Recommendations for a skill list |
| GET | `/courses/recommendations/:jobId` | Applicant | Recommendations for a job's missing skills |

### Notifications

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/notifications` | Authenticated | List notifications + unread count |
| PATCH | `/notifications/read-all` | Authenticated | Mark all as read |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one as read |

### Quick API Examples (PowerShell)

```powershell
# Health
Invoke-RestMethod http://localhost:5000/api/health

# Log in
$login = Invoke-RestMethod -Method Post `
  -Uri http://localhost:5000/api/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"applicant@demo.com","password":"Applicant@123"}'

$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

# Jobs with match data
Invoke-RestMethod -Uri "http://localhost:5000/api/jobs?page=1&limit=5&sort=match" -Headers $headers

# Applicant dashboard
Invoke-RestMethod -Uri http://localhost:5000/api/applicant/dashboard -Headers $headers
```

---

## Core Logic Explained

### 1. Resume text extraction

- **PDF** → `pdf-parse` reads the text layer of the uploaded file.
- **DOCX** → `mammoth.extractRawText()` reads the document text.
- **Scanned/image-only PDFs contain no text layer**, so no skills can be extracted. Upload a text-based PDF or a DOCX instead.
- Files are stored under `backend/uploads/resumes/` with a generated filename; the original name is kept in MongoDB.

### 2. Skill extraction

`backend/utils/skillExtractor.js` uses an explainable keyword dictionary plus aliases:

- `react.js`, `reactjs` → `React`
- `nodejs`, `node js` → `Node.js`
- `postgres` → `PostgreSQL`
- `ml` → `Machine Learning`
- `restful api` → `REST API`

Matching is done on **whole skill names**, so `Java` does not match inside `JavaScript`, and `SQL` does not match inside `MySQL`. The final `skills` list is the union of extracted and manually added skills, normalized and de-duplicated.

### 3. Match percentage

```
Match % = round( (matched required skills / total required skills) × 100 )
```

Example: a job requires `Python, React, SQL, Docker, Git` (5 skills) and the applicant has `Python, React, SQL` → **3 ÷ 5 × 100 = 60%**.

- `matchedSkills` are shown in **green**.
- `missingSkills` are shown in **red**.
- Jobs with zero required skills return **0%** (handled safely, no division by zero).
- The same function is used for job details, the job list, candidate search and course recommendations, so results are consistent everywhere.

### 4. Daily application limit (10/day, Asia/Kolkata)

The limit is enforced by the **backend**, not the UI:

1. `getKolkataDateKey()` converts the current time to `YYYY-MM-DD` in the `Asia/Kolkata` timezone, independent of the server's local timezone.
2. `reserveDailySlot()` runs an atomic MongoDB update:

   ```js
   findOneAndUpdate(
     { applicant, dateKey },
     { $inc: { count: 1 } },
     { new: true, upsert: true }
   )
   ```

3. If the new count exceeds `10`, the reservation is released (`$inc: -1`) and the API responds with **HTTP 429**.
4. A unique index on `(applicant, dateKey)` plus a retry loop handles the rare race when two first-time requests both try to insert the counter document.
5. If the application insert later fails, the reserved slot is released so the user is not unfairly blocked.

Because `$inc` is atomic in MongoDB, concurrent requests cannot both read the same count. The automated test fires **12 simultaneous applications** and verifies exactly **10 succeed** and **2 are rejected with 429**.

Duplicate applications are prevented separately by the unique `(applicant, job)` index and an explicit check, returning **HTTP 409**.

### 5. Course recommendations

- Missing skills are collected from the match result.
- Courses are looked up in the `courses` collection by `skill` (case-insensitive).
- If a skill has no stored course, a built-in fallback is used.
- Free search links are also generated (for example a YouTube search URL), so recommendations always work without external API keys.

### 6. Notifications

Notifications are written server-side by `notifyUser()`:

- When an applicant applies → confirmation for the applicant and a "new application" notification for the recruiter.
- When a recruiter changes a status → notification for the applicant.
- The bell polls on page load and after actions; there is no WebSocket connection.

---

## Prerequisites

Install these before starting:

1. **Node.js 18 or newer** — <https://nodejs.org/>
2. **npm** (bundled with Node.js)
3. **MongoDB Community Server 6 or newer** — <https://www.mongodb.com/try/download/community>
4. A modern browser (Chrome, Edge, Firefox)

Verify the installation in PowerShell:

```powershell
node --version
npm --version
mongod --version
```

> The project was built and tested with Node.js **24.20.0**, npm **11.19.0** and MongoDB **8.3.8** on Windows.

---

## Installation (PowerShell)

### 1. Open the project

```powershell
cd C:\job-skill-matcher
```

### 2. Install backend dependencies

```powershell
cd C:\job-skill-matcher\backend
npm install
```

The frontend has **no dependencies** (Chart.js and Font Awesome are already vendored).

### 3. Create the environment file

```powershell
Copy-Item .env.example .env
```

Open `backend\.env` and set a long random `JWT_SECRET`. You can generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Example `.env`:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/job_skill_matcher
JWT_SECRET=paste_your_long_random_secret_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5500
NODE_ENV=development
```

> `.env` is ignored by git. Never commit real secrets.

---

## MongoDB Setup

The default connection string is:

```text
mongodb://127.0.0.1:27017/job_skill_matcher
```

The database and collections are created automatically on first write (seed or registration). You do **not** need to create them manually.

### Option A — MongoDB installed as a Windows service (recommended)

Check the service:

```powershell
Get-Service MongoDB
```

Start it if it is stopped (run PowerShell as Administrator):

```powershell
Start-Service MongoDB
```

### Option B — Start `mongod` manually

Create a data folder and start MongoDB in its own terminal:

```powershell
New-Item -ItemType Directory -Force C:\data\db
mongod --dbpath C:\data\db
```

Keep that terminal open. If `mongod` is not on your PATH, use the full path, for example:

```powershell
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath C:\data\db
```

### Optional — inspect the data

Using `mongosh`:

```powershell
mongosh "mongodb://127.0.0.1:27017/job_skill_matcher"
```

```javascript
show collections
db.users.countDocuments()
db.jobs.countDocuments()
db.applications.countDocuments()
```

---

## Running the Application

Use **three terminals**: MongoDB (if not a service), backend, frontend.

### Terminal 1 — MongoDB

Only needed if MongoDB is not already running as a service:

```powershell
mongod --dbpath C:\data\db
```

### Terminal 2 — Backend API (port 5000)

```powershell
cd C:\job-skill-matcher\backend
npm start
```

Expected output:

```text
MongoDB connected: ...
Job Skill Matcher API running at http://localhost:5000
```

For auto-restart during development:

```powershell
npm run dev
```

### Terminal 3 — Frontend (port 5500)

```powershell
cd C:\job-skill-matcher\frontend
node server.js
```

Expected output:

```text
Frontend running at http://localhost:5500
```

Alternative from the backend folder:

```powershell
cd C:\job-skill-matcher\backend
npm run frontend
```

### Open the application

| URL | Purpose |
| --- | --- |
| <http://localhost:5500> | **Recommended frontend** |
| <http://localhost:5000> | API + optional frontend hosted by Express |
| <http://localhost:5000/api/health> | API health check |

> Always open the app through `http://localhost:5500` (or `:5000`). Opening `index.html` directly with `file://` will break Fetch API requests and localStorage-based session handling.

### Stop the servers

Press `Ctrl + C` in each terminal.

---

## Seed / Demo Data

Run the seed script after MongoDB is running:

```powershell
cd C:\job-skill-matcher\backend
npm run seed
```

The script is **idempotent** — safe to run multiple times. It uses stable `seedKey` values and `upsert` so it does not create duplicate jobs, courses or notifications.

### What gets seeded

- **10 users**: 3 recruiters and 7 applicants.
- **20 jobs** across Full Stack, Frontend, Backend, Python, Java, Data Analyst, Data Scientist, ML, Database, Web Development and internships.
- **36 free courses** from MDN, freeCodeCamp, Coursera, Google Developers, MongoDB University, AWS Skill Builder and others.
- **7 PDF resumes** with realistic skills (sample files are tracked in `backend/seed/samples/`).
- **12 applications** across statuses and past dates (so they do not consume today's limit).
- Sample notifications.

Seed sample resumes are copied into `backend/uploads/resumes/`, which is gitignored — running the seed recreates them.

### Reset to a clean demo state

If you want to start over, drop the database and reseed:

```powershell
mongosh "mongodb://127.0.0.1:27017/job_skill_matcher" --eval "db.dropDatabase()"
cd C:\job-skill-matcher\backend
npm run seed
```

> This deletes all users, jobs, applications and uploads records. Uploaded files may remain on disk; you can clear `backend\uploads\resumes\` except `.gitkeep`.

---

## Testing

### Automated API test suite

The suite contains **28 end-to-end tests** and covers:

- Health check and database connection.
- Invalid login, weak password, duplicate email, malformed JWT.
- Registration of applicants and recruiters.
- Role protection (applicant blocked from recruiter APIs).
- PDF upload + skill extraction.
- DOCX upload + replacement.
- Unsupported file type rejection.
- Manual skill updates.
- Job creation, ownership protection on update/delete, partial update.
- Live match on job details.
- Course recommendations.
- Apply, duplicate apply prevention.
- Tracking with status counts and daily-limit metadata.
- **Concurrent 10-per-day limit** (12 simultaneous requests → 10 succeed, 2 rejected).
- Recruiter dashboard statistics.
- Candidate search with job match and pagination.
- Candidate privacy.
- Authorized resume downloads (owner, related recruiter, unrelated recruiter).
- Status updates + applicant notification.
- Unauthorized status update.
- Soft delete hides the job from the public API.

**Requirements:**

1. MongoDB is running.
2. The backend is running on `http://localhost:5000`.
3. The seed sample PDFs exist in `backend/seed/samples/`.

Run:

```powershell
cd C:\job-skill-matcher\backend
npm test
```

Expected ending:

```text
--------------------------------------------------
Tests passed: 28
Tests failed: 0
--------------------------------------------------
```

The suite creates temporary users, jobs, resumes and applications, then **deletes them automatically** in its `finally` cleanup block. It also removes temporary uploaded files and daily counters.

To test a different API URL:

```powershell
$env:TEST_API_URL = "http://localhost:5000"
npm test
```

### Manual smoke test checklist

1. Open <http://localhost:5500> and browse jobs as a guest.
2. Log in as `applicant@demo.com`.
3. Open a job and confirm the match ring, green matched skills and red missing skills.
4. Upload a PDF/DOCX resume from **Profile & resume** and confirm skills update.
5. Apply to a job, then try again and confirm the duplicate warning.
6. Open **My applications** and confirm the status, match and daily-limit card.
7. Log in as `recruiter@demo.com`.
8. Create a job, edit it, then close it (soft delete).
9. Open **Candidates**, search by name or skill, select a job and check match percentages.
10. Open **Applications**, change a status, then log back in as the applicant and confirm the notification.

---

## Screenshots

Add your own screenshots to a `docs/screenshots/` folder and reference them here. Suggested set:

| File | Suggested screen |
| --- | --- |
| `docs/screenshots/01-home.png` | Landing page |
| `docs/screenshots/02-jobs.png` | Job listing with filters |
| `docs/screenshots/03-job-details-match.png` | Match ring, green/red skills, courses |
| `docs/screenshots/04-applicant-dashboard.png` | Applicant stats and charts |
| `docs/screenshots/05-profile-resume.png` | Resume upload and skill editor |
| `docs/screenshots/06-applications.png` | Application tracking |
| `docs/screenshots/07-recruiter-dashboard.png` | Recruiter overview and chart |
| `docs/screenshots/08-recruiter-candidates.png` | Candidate search with match |
| `docs/screenshots/09-recruiter-applications.png` | Status management |
| `docs/screenshots/10-mobile.png` | Responsive mobile view |

Example markdown once files are added:

```markdown
![Job details with match ring](docs/screenshots/03-job-details-match.png)
```

---

## Security Notes

- Passwords are hashed with **bcryptjs**; the hash field is `select: false`.
- JWT secret must be long and private. Rotate it if it is ever exposed.
- Role checks are enforced server-side; hiding a button in the UI is never the only protection.
- Recruiters can only modify their own jobs and applications.
- Resume downloads require ownership or an application relationship.
- Uploads are limited to PDF/DOCX and 5 MB; stored filenames are generated server-side.
- Inputs are trimmed, length-limited and sanitized; regex filters escape user input.
- The API sets `x-powered-by: false`, and CORS is restricted to configured/localhost origins in development.

For a production deployment you would additionally add HTTPS, rate limiting, security headers (Helmet), malware scanning, refresh-token rotation, email verification and centralized logging.

---

## Limitations

This is an academic/demo project. Be honest about these limits when presenting it:

- **Skill extraction is keyword-based**, not NLP or ML. It recognises the dictionary in `utils/skillExtractor.js`; unusual synonyms and skills outside the list are missed.
- **Scanned/image-only PDFs** produce no text and therefore no skills.
- **No load testing has been performed.** The project is not claimed to support a specific number of concurrent users. It is intended for local demonstration and small academic use.
- **Single MongoDB instance** on localhost. No replica set, sharding or transactions beyond single-document atomic operations.
- **JWT is stored in `localStorage`**, which is convenient for a demo but exposed to XSS. There are no refresh tokens or server-side token revocation.
- **No email verification, password reset or email notifications.** Notifications are in-app only and refresh on page load/actions.
- **Resume files are stored on local disk**, not in cloud storage or a CDN.
- **Soft delete only** for jobs; there is no admin hard-delete or restore UI beyond reopening.
- **No admin role**, audit log or analytics export.
- Charts show the current user's/recruiter's data only; there is no global analytics.
- The daily limit uses the **Asia/Kolkata** calendar day by design and is not configurable from the UI.
- Currency is displayed as free text (`salaryRange`); no currency conversion.
- Upload validation is extension/MIME-based; production systems should inspect file contents and scan for malware.

---

## Future Enhancements

- Replace keyword extraction with spaCy/NLP or an LLM-based parser, with a confidence score.
- Add email verification, password reset and email notifications.
- Add refresh tokens, token revocation and optional two-factor authentication.
- Add an admin role with moderation, audit logs and analytics.
- Move resume storage to S3/Cloudinary with signed URLs.
- Add saved jobs, job alerts and candidate shortlisting notes.
- Add interview scheduling and recruiter–applicant messaging.
- Add automated frontend tests (Playwright/Cypress) and CI.
- Add pagination virtualization and server-side caching for large datasets.
- Add Docker Compose for one-command startup.

---

## Troubleshooting

### `MongooseServerSelectionError` / cannot connect to MongoDB

- Start MongoDB (`Start-Service MongoDB` or `mongod --dbpath C:\data\db`).
- Confirm the URI in `backend\.env` is `mongodb://127.0.0.1:27017/job_skill_matcher`.
- Check the service: `Get-Service MongoDB`.

### `EADDRINUSE` on port 5000 or 5500

Find and stop the process using the port:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen |
  Select-Object LocalPort, OwningProcess
Stop-Process -Id <OwningProcess>
```

Or change the port in `backend\.env` (`PORT`) / start the frontend with `$env:FRONTEND_PORT=5501; node server.js`.

### CORS error in the browser

- Open the app at `http://localhost:5500`, not `file://`.
- Confirm `CLIENT_URL=http://localhost:5500` in `.env`.
- In development, any `localhost`/`127.0.0.1` origin is allowed.

### Login fails / "session expired"

- Make sure the backend is running and `JWT_SECRET` is set.
- Clear the browser's site data for `localhost` and log in again.
- If you changed `JWT_SECRET`, all old tokens become invalid.

### Resume upload says no skills found

- The PDF may be a scanned image. Try a text-based PDF or a DOCX.
- Add missing skills manually from **Profile & resume → Review skills**.

### Seed fails with "Sample resume missing"

Run the seed from the backend folder and confirm these files exist:

```powershell
Test-Path C:\job-skill-matcher\backend\seed\samples\seed-ananya-sharma.pdf
```

If they are missing, restore them from the repository (they are tracked in git).

### `npm test` fails immediately

The tests call the running API. Start the backend first:

```powershell
cd C:\job-skill-matcher\backend
npm start
```

Then run `npm test` in another terminal.

### Charts or icons do not appear

Both are vendored locally under `frontend/vendor/`. Confirm the files exist and that you are serving the frontend over HTTP (not opening the HTML file directly).

---

## Academic Notes

- **Project type:** Full Stack Development (FSD) academic project.
- **Architecture:** Three-tier — presentation (HTML/CSS/JS), application (Express REST API), data (MongoDB).
- **Key viva topics:**
  - JWT authentication flow and role-based authorization.
  - bcrypt password hashing.
  - Resume parsing with `pdf-parse` and `mammoth`.
  - Explainable match formula.
  - MongoDB atomic `$inc` and unique indexes for concurrency-safe limits.
  - Mongoose relationships and aggregation pipelines.
  - REST resource design and HTTP status codes (`201`, `400`, `401`, `403`, `404`, `409`, `429`).
  - Responsive CSS with Flexbox/Grid and media queries.
- **Demonstration flow:** log in as applicant → upload resume → view match on a job → apply → log in as recruiter → search candidate → update status → log back in as applicant → see notification and status change.

---

## License

MIT — free to use for learning and academic submissions. Demo data and company names are fictional.
