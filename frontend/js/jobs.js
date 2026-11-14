// js/jobs.js
// Handles both the public job listing page and the job details page.
// Everything is rendered from live API responses - no hardcoded job data.
(function () {
  'use strict';

  const page = document.body.dataset.page;
  const CATEGORY_ICONS = {
    'Full Stack Developer': 'fa-layer-group',
    'Frontend Developer': 'fa-code',
    'Backend Developer': 'fa-server',
    'Python Developer': 'fa-python',
    'Java Developer': 'fa-mug-hot',
    'Data Analyst': 'fa-chart-line',
    'Data Scientist': 'fa-flask',
    'Machine Learning Engineer': 'fa-robot',
    'Database Developer': 'fa-database',
    'Web Developer': 'fa-globe',
    Other: 'fa-briefcase',
  };

  let currentUser = null;

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = el(id);
    if (element) element.textContent = value;
  }

  function matchClass(percentage) {
    const value = Number(percentage) || 0;
    if (value >= 75) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  }

  function jobMeta(job) {
    return [job.company, job.location].filter(Boolean).join(' • ');
  }

  function renderRingCharts() {
    document.querySelectorAll('[data-ring-value]').forEach((ring) => {
      App.setProgressRing(ring, ring.dataset.ringValue);
    });
  }

  function isApplicant() {
    return currentUser && currentUser.role === 'applicant';
  }

  /* =======================================================================
   * JOBS LISTING PAGE
   * ==================================================================== */
  let jobsPage = 1;

  function readFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const mapping = {
      'filter-q': params.get('q') || '',
      'filter-location': params.get('location') || '',
      'filter-category': params.get('category') || '',
      'filter-type': params.get('jobType') || '',
      'filter-experience': params.get('experienceLevel') || '',
      'filter-skills': params.get('skills') || '',
    };
    Object.entries(mapping).forEach(([id, value]) => {
      const input = el(id);
      if (input) input.value = value;
    });

    const sort = params.get('sort') || 'newest';
    const sortSelect = el('jobs-sort');
    if (sortSelect) sortSelect.value = sort;
    jobsPage = Math.max(1, Number(params.get('page')) || 1);
  }

  function currentFilterParams() {
    const params = new URLSearchParams();
    const values = {
      q: (el('filter-q') || {}).value || '',
      location: (el('filter-location') || {}).value || '',
      category: (el('filter-category') || {}).value || '',
      jobType: (el('filter-type') || {}).value || '',
      experienceLevel: (el('filter-experience') || {}).value || '',
      skills: (el('filter-skills') || {}).value || '',
      sort: (el('jobs-sort') || {}).value || 'newest',
    };
    Object.entries(values).forEach(([key, value]) => {
      if (String(value).trim()) params.set(key, String(value).trim());
    });
    return params;
  }

  function updateUrl(params) {
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', next);
  }

  function renderJobCard(job) {
    const percentage = Number(job.matchPercentage) || 0;
    const icon = CATEGORY_ICONS[job.category] || CATEGORY_ICONS.Other;
    const hasMatch = isApplicant();
    const appliedBadge = job.hasApplied
      ? `<span class="applied-label"><i class="fa-solid fa-circle-check"></i> Applied${job.applicationStatus ? ` • ${App.escapeHtml(job.applicationStatus)}` : ''}</span>`
      : '';

    return `
      <article class="job-card">
        <div class="job-card-top">
          <div class="job-company-line">
            <span class="company-avatar">${App.initials(job.company)}</span>
            <div>
              <h3><a href="job-details.html?id=${encodeURIComponent(job._id)}">${App.escapeHtml(job.title)}</a></h3>
              <p>${App.escapeHtml(job.company)}</p>
            </div>
          </div>
          <span class="badge badge-blue"><i class="fa-solid ${icon}"></i> ${App.escapeHtml(job.category || 'Other')}</span>
        </div>

        <div class="job-meta">
          <span><i class="fa-solid fa-location-dot"></i> ${App.escapeHtml(job.location)}</span>
          <span><i class="fa-regular fa-clock"></i> ${App.escapeHtml(job.jobType)}</span>
          <span><i class="fa-solid fa-briefcase"></i> ${App.escapeHtml(job.experienceLevel)}</span>
        </div>

        <div class="job-skills">
          <div class="skill-list">${App.skillChips(job.requiredSkills, 'default', 6)}</div>
        </div>

        <div class="job-card-bottom">
          <div>
            <span class="job-salary">${App.escapeHtml(job.salaryRange || 'Salary not disclosed')}</span>
            <small class="muted" style="display:block;font-size:0.68rem;">Posted ${App.formatDate(job.createdAt)}</small>
          </div>
          ${hasMatch
            ? `<div class="job-match-inline">
                 <div class="match-ring" data-ring-value="${percentage}"><span class="match-ring-value">${percentage}%</span></div>
                 <span>${job.matchedCount || 0} of ${job.totalRequired || 0} skills matched</span>
               </div>`
            : appliedBadge || '<a class="btn btn-outline btn-sm" href="login.html?redirect=jobs.html">Sign in to match</a>'}
        </div>

        <div class="job-card-bottom" style="border-top:0;padding-top:12px;margin-top:0;">
          <a class="btn btn-primary btn-sm" href="job-details.html?id=${encodeURIComponent(job._id)}">
            View details <i class="fa-solid fa-arrow-right"></i>
          </a>
          ${hasMatch && job.hasApplied ? appliedBadge : ''}
        </div>
      </article>`;
  }

  function renderJobs(jobs, pagination, total) {
    const grid = el('jobs-grid');
    if (!grid) return;

    if (!jobs || jobs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <h3>No jobs match these filters</h3>
          <p>Try a different keyword, location or skill. New openings are added regularly.</p>
          <button type="button" class="btn btn-primary btn-sm" id="clear-job-filters">Clear filters</button>
        </div>`;
      const clearButton = el('clear-job-filters');
      if (clearButton) {
        clearButton.addEventListener('click', () => {
          const form = el('jobs-filter-form');
          if (form) form.reset();
          jobsPage = 1;
          loadJobs(1);
        });
      }
    } else {
      grid.innerHTML = jobs.map(renderJobCard).join('');
      renderRingCharts();
    }

    const count = pagination ? pagination.total : total || 0;
    setText('jobs-count', `${count} opening${count === 1 ? '' : 's'}`);
    setText('jobs-result-summary', `Showing ${jobs.length} of ${count} job${count === 1 ? '' : 's'}`);

    App.renderPagination(el('jobs-pagination'), pagination, (nextPage) => {
      loadJobs(nextPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function updateMatchBanner() {
    const banner = el('match-empty-banner');
    const message = el('match-empty-message');
    if (!banner || !message) return;

    if (!currentUser) {
      banner.hidden = false;
      message.innerHTML = '<strong>Sign in to see your skill match.</strong> Log in as an applicant and upload a resume to compare your skills with every job.';
      return;
    }

    if (currentUser.role !== 'applicant') {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    message.innerHTML = '<strong>Your match score uses your resume skills.</strong> Update your skills in your profile to keep scores accurate. <a href="profile.html">Review skills</a>';
  }

  async function loadJobs(requestedPage) {
    jobsPage = Math.max(1, Number(requestedPage) || 1);
    const params = currentFilterParams();
    params.set('page', jobsPage);
    params.set('limit', 6);
    updateUrl(params);

    const sort = params.get('sort');
    const grid = el('jobs-grid');
    if (grid) {
      grid.innerHTML = '<div class="loading-state" style="grid-column: 1 / -1;"><span class="spinner"></span> Loading job postings...</div>';
    }
    updateMatchBanner();

    try {
      let response;
      const wantsMatchSort = sort === 'match' && isApplicant();
      if (wantsMatchSort) {
        response = await App.api(`/jobs/matches?${params.toString()}`);
      } else {
        if (sort === 'match') params.set('sort', 'newest');
        response = await App.api(`/jobs?${params.toString()}`);
      }
      renderJobs(response.data || [], response.pagination, response.data ? response.data.length : 0);
    } catch (error) {
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>Could not load jobs</h3>
            <p>${App.escapeHtml(error.message)}</p>
          </div>`;
      }
      App.showToast(error.message, 'error');
    }
  }

  function initJobsPage() {
    readFiltersFromUrl();

    const form = el('jobs-filter-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        loadJobs(1);
      });
      form.addEventListener('reset', () => {
        setTimeout(() => {
          const sort = el('jobs-sort');
          if (sort) sort.value = 'newest';
          loadJobs(1);
        }, 0);
      });
    }

    const sortSelect = el('jobs-sort');
    if (sortSelect) sortSelect.addEventListener('change', () => loadJobs(1));

    loadJobs(jobsPage);
  }

  /* =======================================================================
   * JOB DETAILS PAGE
   * ==================================================================== */
  let currentJob = null;

  function renderJobFacts(job) {
    setText('job-detail-title', job.title);
    setText('job-detail-company', job.company);
    setText('job-detail-location', job.location);
    setText('job-detail-type', job.jobType);
    setText('job-detail-experience', job.experienceLevel);
    setText('job-detail-type-side', job.jobType);
    setText('job-detail-experience-side', job.experienceLevel);
    setText('job-detail-category', job.category || 'Other');
    setText('job-detail-salary', job.salaryRange || 'Not disclosed');
    setText('job-detail-posted', App.formatDate(job.createdAt));
    setText('job-detail-description', job.description);

    const companyAvatar = el('job-detail-avatar');
    if (companyAvatar) companyAvatar.textContent = App.initials(job.company);

    const badge = el('job-detail-category-badge');
    if (badge) {
      badge.innerHTML = `<i class="fa-solid ${CATEGORY_ICONS[job.category] || CATEGORY_ICONS.Other}"></i> ${App.escapeHtml(job.category || 'Other')}`;
    }

    const skills = el('job-required-skills');
    if (skills) skills.innerHTML = App.skillChips(job.requiredSkills, 'default');

    const ownerPanel = el('job-owner-panel');
    if (ownerPanel) {
      ownerPanel.hidden = !job.isOwner;
      if (job.isOwner) {
        setText('job-application-count', job.applicationCount || 0);
      }
    }

    const ownerActions = el('job-owner-actions');
    if (ownerActions) ownerActions.hidden = !job.isOwner;
  }

  function renderMatchPanel(job) {
    const panel = el('job-match-panel');
    const guestPanel = el('job-guest-match');
    const match = job.match;

    if (!isApplicant()) {
      if (panel) panel.hidden = true;
      if (guestPanel) {
        guestPanel.hidden = false;
        guestPanel.innerHTML = currentUser
          ? '<p class="muted text-small">Only applicant accounts can calculate a skill match and apply for jobs.</p>'
          : '<p class="muted text-small">Log in as an applicant to see your match score, matched skills and missing skills for this job.</p><a class="btn btn-primary btn-sm btn-block mt-2" href="login.html?redirect=job-details.html%3Fid%3D' + encodeURIComponent(job._id) + '">Login to check match</a>';
      }
      return;
    }

    if (guestPanel) guestPanel.hidden = true;
    if (panel) panel.hidden = false;

    const percentage = match ? Number(match.matchPercentage) || 0 : 0;
    App.setProgressRing(el('job-detail-ring'), percentage);
    setText('job-match-percentage', `${percentage}%`);
    setText('job-matched-count', match ? match.matchedCount : 0);
    setText('job-required-count', match ? match.totalRequired : (job.requiredSkills || []).length);
    setText('job-missing-count', match ? match.missingSkills.length : 0);

    const matchedList = el('job-matched-skills');
    if (matchedList) {
      matchedList.innerHTML = match && match.matchedSkills.length
        ? App.skillChips(match.matchedSkills, 'matched')
        : '<span class="muted text-small">No required skills matched yet.</span>';
    }

    const missingList = el('job-missing-skills');
    if (missingList) {
      missingList.innerHTML = match && match.missingSkills.length
        ? App.skillChips(match.missingSkills, 'missing')
        : '<span class="muted text-small">Great news - you match every required skill.</span>';
    }

    const note = el('job-match-note');
    if (note) {
      note.textContent = match && match.totalRequired === 0
        ? 'This job has no required skills listed, so the match score is 0%.'
        : 'Match = matched required skills ÷ total required skills.';
    }
  }

  function renderApplyState(job) {
    const button = el('job-apply-button');
    const note = el('job-apply-note');
    if (!button) return;

    button.disabled = false;
    button.classList.remove('btn-success');
    button.classList.add('btn-primary');

    if (!currentUser) {
      button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login to apply';
      button.onclick = () => {
        window.location.href = `login.html?redirect=${encodeURIComponent(`job-details.html?id=${job._id}`)}`;
      };
      if (note) note.textContent = 'Applications are only accepted from signed-in applicant accounts.';
      return;
    }

    if (job.isOwner) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-lock"></i> Your own posting';
      if (note) note.textContent = 'You can manage this posting from your recruiter workspace.';
      return;
    }

    if (currentUser.role !== 'applicant') {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-lock"></i> Applicants only';
      if (note) note.textContent = 'Recruiter accounts cannot apply for jobs.';
      return;
    }

    if (job.hasApplied) {
      button.disabled = true;
      button.classList.remove('btn-primary');
      button.classList.add('btn-success');
      button.innerHTML = '<i class="fa-solid fa-circle-check"></i> Already applied';
      if (note) {
        note.innerHTML = `You applied on ${App.formatDate(job.application.appliedAt)}. Current status: ${App.statusBadge(job.application.status)} <a href="applications.html">Track application</a>`;
      }
      return;
    }

    button.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Apply now';
    button.onclick = applyForJob;
    if (note) note.textContent = 'Your resume skills will be saved with this application as a match snapshot.';
  }

  async function applyForJob() {
    if (!currentJob) return;
    const button = el('job-apply-button');
    const alertBox = el('job-apply-alert');
    if (alertBox) alertBox.hidden = true;

    App.setButtonLoading(button, true, 'Submitting...');
    try {
      const response = await App.api(`/applications/apply/${currentJob._id}`, { method: 'POST' });
      App.showToast(response.message, 'success', 'Application submitted');
      if (alertBox) {
        alertBox.hidden = false;
        alertBox.className = 'form-alert form-alert-success';
        alertBox.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${App.escapeHtml(response.message)}</span>`;
      }
      await loadJobDetails(currentJob._id);
    } catch (error) {
      if (alertBox) {
        alertBox.hidden = false;
        alertBox.className = `form-alert form-alert-${error.status === 429 ? 'warning' : 'error'}`;
        alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${App.escapeHtml(error.message)}</span>`;
      }
      App.showToast(error.message, error.status === 429 ? 'warning' : 'error');
      if (error.status === 409) await loadJobDetails(currentJob._id);
      else App.setButtonLoading(button, false);
    }
  }

  function renderCourses(recommendations) {
    const container = el('job-courses');
    const section = el('job-courses-section');
    if (!container) return;

    if (!recommendations || !recommendations.missingSkills || recommendations.missingSkills.length === 0) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;

    const courses = recommendations.courses || [];
    const searchLinks = recommendations.searchLinks || [];
    const missing = recommendations.missingSkills || [];

    const courseGroups = missing.map((skill) => {
      const skillCourses = courses.filter((course) => String(course.skill).toLowerCase() === skill.toLowerCase());
      if (skillCourses.length === 0) return '';
      return `
        <div class="course-group-title"><i class="fa-solid fa-graduation-cap"></i> Learn ${App.escapeHtml(skill)}</div>
        <div class="course-list">
          ${skillCourses.map((course) => `
            <div class="course-card">
              <span class="course-icon"><i class="fa-solid fa-play"></i></span>
              <div class="course-copy">
                <strong>${App.escapeHtml(course.title)}</strong>
                <span>${App.escapeHtml(course.platform)}${course.isFree ? ' • Free' : ''}</span>
                ${course.description ? `<p>${App.escapeHtml(course.description)}</p>` : ''}
                <a href="${App.escapeHtml(course.url)}" target="_blank" rel="noopener noreferrer">Start learning <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
              </div>
            </div>`).join('')}
        </div>`;
    }).join('');

    const searchGroup = searchLinks.length
      ? `<div class="course-group-title"><i class="fa-solid fa-magnifying-glass"></i> More free search links</div>
         <div class="search-links">
           ${searchLinks.map((link) => `
             <a class="btn btn-light btn-sm" href="${App.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
               ${App.escapeHtml(link.skill)} on ${App.escapeHtml(link.platform)} <i class="fa-solid fa-arrow-up-right-from-square"></i>
             </a>`).join('')}
         </div>`
      : '';

    container.innerHTML = courseGroups || searchGroup
      ? `${courseGroups}${searchGroup}`
      : '<p class="muted text-small">No course recommendations are available for the missing skills yet.</p>';
  }

  async function loadCourseRecommendations(jobId) {
    const section = el('job-courses-section');
    if (!isApplicant()) {
      if (section) section.hidden = true;
      return;
    }

    const container = el('job-courses');
    if (container) container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Finding courses for your missing skills...</div>';

    try {
      const response = await App.api(`/courses/recommendations/${jobId}`);
      renderCourses(response.recommendations);
    } catch (error) {
      if (container) {
        container.innerHTML = `<p class="muted text-small">${App.escapeHtml(error.message)}</p>`;
      }
    }
  }

  async function loadJobDetails(jobId) {
    const layout = el('job-details-layout');
    const loading = el('job-details-loading');
    if (layout) layout.hidden = true;
    if (loading) loading.hidden = false;

    try {
      const response = await App.api(`/jobs/${encodeURIComponent(jobId)}`);
      currentJob = response.data;

      renderJobFacts(currentJob);
      renderMatchPanel(currentJob);
      renderApplyState(currentJob);

      const notFound = el('job-not-found');
      if (notFound) notFound.hidden = true;
      if (loading) loading.hidden = true;
      if (layout) layout.hidden = false;

      await loadCourseRecommendations(currentJob._id);
    } catch (error) {
      if (layout) layout.hidden = true;
      if (loading) loading.hidden = true;
      const notFound = el('job-not-found');
      if (notFound) {
        notFound.hidden = false;
        notFound.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-briefcase"></i>
            <h3>Job not available</h3>
            <p>${App.escapeHtml(error.message)}</p>
            <a class="btn btn-primary btn-sm" href="jobs.html">Browse all jobs</a>
          </div>`;
      }
    }
  }

  function initJobDetailsPage() {
    const jobId = App.getQueryParam('id');
    const notFound = el('job-not-found');
    if (!jobId) {
      const layout = el('job-details-layout');
      if (layout) layout.hidden = true;
      if (notFound) {
        notFound.hidden = false;
        notFound.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>No job selected</h3>
            <p>Open a job from the listing page to see its full details.</p>
            <a class="btn btn-primary btn-sm" href="jobs.html">Browse jobs</a>
          </div>`;
      }
      return;
    }

    loadJobDetails(jobId);
  }

  /* =======================================================================
   * Start
   * ==================================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await App.authReady;

    if (page === 'jobs') initJobsPage();
    else if (page === 'job-details') initJobDetailsPage();
  });
})();
