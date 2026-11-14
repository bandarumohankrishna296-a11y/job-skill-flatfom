// js/applicant.js
// Page controller for the applicant dashboard, profile page and application tracker.
(function () {
  'use strict';

  const page = document.body.dataset.page;
  let statusChart = null;

  const STATUS_ORDER = ['Pending', 'Shortlisted', 'Accepted', 'Rejected'];
  const STATUS_COLORS = {
    Pending: '#f59e0b',
    Shortlisted: '#0ea5e9',
    Accepted: '#16a34a',
    Rejected: '#ef4444',
  };

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = el(id);
    if (element) element.textContent = value;
  }

  function firstName(name) {
    return String(name || 'Applicant').trim().split(/\s+/)[0];
  }

  function matchClass(percentage) {
    const value = Number(percentage) || 0;
    if (value >= 75) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  }

  function jobMeta(job) {
    const parts = [];
    if (job && job.company) parts.push(job.company);
    if (job && job.location) parts.push(job.location);
    return parts.join(' • ');
  }

  /* -----------------------------------------------------------------------
   * Shared renderers
   * -------------------------------------------------------------------- */
  function renderRingCharts() {
    document.querySelectorAll('[data-ring-value]').forEach((ring) => {
      App.setProgressRing(ring, ring.dataset.ringValue);
    });
  }

  function renderStatusChart(statusCounts) {
    const canvas = el('applicant-status-chart');
    if (!canvas) return;

    const values = STATUS_ORDER.map((status) => Number(statusCounts[status]) || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    setText('chart-total-applications', total);

    if (typeof Chart === 'undefined') return;
    if (statusChart) statusChart.destroy();

    statusChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: STATUS_ORDER,
        datasets: [{
          data: values,
          backgroundColor: STATUS_ORDER.map((status) => STATUS_COLORS[status]),
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return ` ${context.label}: ${context.parsed}`;
              },
            },
          },
        },
      },
    });
  }

  function renderStatusLegend(containerId, statusCounts) {
    const container = el(containerId);
    if (!container) return;

    container.innerHTML = STATUS_ORDER.map((status) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${STATUS_COLORS[status]}"></span>
        <span>${status}</span>
        <strong>${Number(statusCounts[status]) || 0}</strong>
      </div>
    `).join('');
  }

  function renderStatusSummary(containerId, statusCounts) {
    const container = el(containerId);
    if (!container) return;

    container.innerHTML = STATUS_ORDER.map((status) => `
      <div class="status-summary-item">
        <span><span class="legend-dot" style="background:${STATUS_COLORS[status]}"></span>${status}</span>
        <strong>${Number(statusCounts[status]) || 0}</strong>
      </div>
    `).join('');
  }

  function renderLimit(prefix, dailyLimit) {
    if (!dailyLimit) return;
    const id = (suffix) => (prefix ? `${prefix}-${suffix}` : suffix);
    const used = Number(dailyLimit.used) || 0;
    const limit = Number(dailyLimit.limit) || 10;
    const remaining = dailyLimit.remaining !== undefined
      ? Number(dailyLimit.remaining)
      : Math.max(0, limit - used);
    const percent = Math.min(100, Math.round((used / limit) * 100));

    setText(id('limit-used'), `${used} / ${limit} used`);
    setText(id('limit-remaining'), remaining === 0
      ? "You have reached today's application limit. It resets at midnight IST."
      : `You can submit ${remaining} more application${remaining === 1 ? '' : 's'} today.`);

    const progress = el(id('limit-progress'));
    if (progress) {
      progress.style.width = `${percent}%`;
      progress.className = 'progress-bar';
      if (percent >= 100) progress.classList.add('red');
      else if (percent >= 70) progress.classList.add('amber');
      else progress.classList.add('green');
    }
  }

  function renderRecentApplications(rows) {
    const body = el('recent-applications-body');
    if (!body) return;

    if (!rows || rows.length === 0) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="table-empty">
            <i class="fa-regular fa-folder-open"></i>
            No applications yet. <a href="jobs.html">Browse jobs</a> to get started.
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = rows.map((application) => {
      const job = application.job || {};
      const title = job.title || 'Job no longer available';
      const company = job.company || '';
      return `
        <tr>
          <td>
            <div class="application-job-cell">
              <strong>${App.escapeHtml(title)}</strong>
              <span>${App.escapeHtml(company)}</span>
            </div>
          </td>
          <td>${App.formatDate(application.appliedAt)}</td>
          <td><span class="match-pill ${matchClass(application.matchPercentage)}">${Number(application.matchPercentage) || 0}%</span></td>
          <td>${App.statusBadge(application.status)}</td>
        </tr>`;
    }).join('');
  }

  function renderTopMatches(jobs) {
    const container = el('top-matches-list');
    if (!container) return;

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:26px 10px;">
          <i class="fa-solid fa-bullseye"></i>
          <h3>No skill matches yet</h3>
          <p>Upload a resume and add your skills to see jobs ranked by match percentage.</p>
          <a class="btn btn-primary btn-sm" href="profile.html">Update profile</a>
        </div>`;
      return;
    }

    container.innerHTML = jobs.map((job) => {
      const percentage = Number(job.matchPercentage) || 0;
      return `
        <a class="match-job-item" href="job-details.html?id=${encodeURIComponent(job._id)}">
          <div class="match-ring" data-ring-value="${percentage}">
            <span class="match-ring-value">${percentage}%</span>
          </div>
          <div class="match-job-copy">
            <strong>${App.escapeHtml(job.title)}</strong>
            <span>${App.escapeHtml(jobMeta(job))}</span>
            <div class="skill-list">${App.skillChips(job.requiredSkills, 'default', 5)}</div>
          </div>
        </a>`;
    }).join('');

    renderRingCharts();
  }

  /* -----------------------------------------------------------------------
   * Applicant dashboard
   * -------------------------------------------------------------------- */
  async function loadApplicantDashboard() {
    try {
      const [dashboard, resumeResponse] = await Promise.all([
        App.api('/applicant/dashboard'),
        App.api('/resumes/my-resume'),
      ]);

      const stats = dashboard.stats || {};
      const dailyLimit = dashboard.dailyLimit || { used: 0, limit: 10, remaining: 10 };
      const resume = resumeResponse.resume || null;

      setText('welcome-name', firstName(dashboard.profile && dashboard.profile.name));
      setText('stat-matching-jobs', stats.matchingJobs || 0);
      setText('stat-applications', stats.totalApplications || 0);
      setText('stat-average', `${stats.averageMatch || 0}%`);
      setText('stat-remaining', dailyLimit.remaining);
      App.setProgressRing(el('applicant-average-ring'), stats.averageMatch || 0);

      const missingBanner = el('resume-missing-banner');
      if (missingBanner) missingBanner.hidden = Boolean(resume);

      ResumeUI.render(resume);
      renderRecentApplications(dashboard.recentApplications);
      renderTopMatches(dashboard.topMatches);
      renderStatusChart(dashboard.statusCounts || {});
      renderStatusLegend('applicant-status-legend', dashboard.statusCounts || {});
      renderLimit('', dailyLimit);
    } catch (error) {
      App.showToast(error.message, 'error', 'Could not load dashboard');
    }
  }

  function initApplicantDashboard() {
    ResumeUI.bindUploadControls({
      onUploaded: loadApplicantDashboard,
      onDeleted: loadApplicantDashboard,
    });
    document.addEventListener('resume:skills-updated', loadApplicantDashboard);
    loadApplicantDashboard();
  }

  /* -----------------------------------------------------------------------
   * Applicant profile
   * -------------------------------------------------------------------- */
  async function loadProfile() {
    try {
      const [dashboard, resumeResponse] = await Promise.all([
        App.api('/applicant/dashboard'),
        App.api('/resumes/my-resume'),
      ]);

      const profile = dashboard.profile || {};
      const stats = dashboard.stats || {};
      const dailyLimit = dashboard.dailyLimit || { used: 0, limit: 10, remaining: 10 };
      const resume = resumeResponse.resume || null;

      setText('profile-avatar', App.initials(profile.name));
      setText('profile-summary-name', profile.name || 'Applicant');
      setText('profile-summary-headline', profile.headline || 'Add a short headline about your goals.');
      setText('profile-summary-location', profile.location || 'Location not added');
      setText('profile-member-since', profile.memberSince
        ? `Member since ${App.formatDate(profile.memberSince)}`
        : '');
      setText('profile-total-applications', stats.totalApplications || 0);
      setText('profile-average-match', `${stats.averageMatch || 0}%`);
      setText('profile-matching-jobs', stats.matchingJobs || 0);
      setText('profile-applications-today', dailyLimit.used || 0);
      setText('profile-skills-count', (resume && resume.skills ? resume.skills.length : 0));

      const missingBanner = el('profile-resume-banner');
      if (missingBanner) missingBanner.hidden = Boolean(resume);

      ResumeUI.render(resume);
      renderLimit('profile', dailyLimit);
    } catch (error) {
      App.showToast(error.message, 'error', 'Could not load profile');
    }
  }

  function initApplicantProfile() {
    ResumeUI.bindUploadControls({
      onUploaded: loadProfile,
      onDeleted: loadProfile,
    });
    document.addEventListener('resume:skills-updated', loadProfile);

    const form = el('profile-form');
    if (form) {
      // auth.js saves the profile; reload the summary once the request completes.
      form.addEventListener('submit', () => setTimeout(loadProfile, 900));
    }

    loadProfile();
  }

  /* -----------------------------------------------------------------------
   * Application tracking
   * -------------------------------------------------------------------- */
  let applicationsPage = 1;

  async function loadApplications(requestedPage) {
    applicationsPage = Math.max(1, Number(requestedPage) || 1);

    const params = new URLSearchParams({ page: applicationsPage, limit: 10 });
    const statusFilter = el('application-status-filter');
    if (statusFilter && statusFilter.value) params.set('status', statusFilter.value);

    const body = el('applications-body');
    if (body) {
      body.innerHTML = '<tr><td colspan="5" class="table-empty"><span class="spinner"></span><br>Loading applications...</td></tr>';
    }

    try {
      const response = await App.api(`/applications/my-applications?${params.toString()}`);
      const rows = response.data || [];

      renderStatusSummary('applications-status-summary', response.statusCounts || {});
      renderLimit('applications', response.dailyLimit || { used: 0, limit: 10, remaining: 10 });
      setText('applications-count', response.pagination ? response.pagination.total : rows.length);
      setText('applications-used-today', (response.dailyLimit && response.dailyLimit.used) || 0);

      if (!body) return;

      if (rows.length === 0) {
        body.innerHTML = `
          <tr>
            <td colspan="5" class="table-empty">
              <i class="fa-regular fa-folder-open"></i>
              No applications found${statusFilter && statusFilter.value ? ' for this status' : ''}.
              <a href="jobs.html">Browse jobs</a>
            </td>
          </tr>`;
      } else {
        body.innerHTML = rows.map((application) => {
          const job = application.job || {};
          const jobId = job._id;
          return `
            <tr>
              <td>
                <div class="application-job-cell">
                  <strong>${App.escapeHtml(job.title || 'Job no longer available')}</strong>
                  <span>${App.escapeHtml(jobMeta(job))}</span>
                </div>
              </td>
              <td>${App.formatDate(application.appliedAt)}</td>
              <td><span class="match-pill ${matchClass(application.matchPercentage)}">${Number(application.matchPercentage) || 0}%</span></td>
              <td>${App.statusBadge(application.status)}</td>
              <td>
                ${jobId
                  ? `<a class="table-action-link" href="job-details.html?id=${encodeURIComponent(jobId)}">
                       View job <i class="fa-solid fa-arrow-right"></i>
                     </a>`
                  : '<span class="muted">Unavailable</span>'}
              </td>
            </tr>`;
        }).join('');
      }

      App.renderPagination(el('applications-pagination'), response.pagination, (nextPage) => {
        loadApplications(nextPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (error) {
      if (body) {
        body.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-triangle-exclamation"></i> ${App.escapeHtml(error.message)}</td></tr>`;
      }
      App.showToast(error.message, 'error', 'Could not load applications');
    }
  }

  function initApplications() {
    const form = el('application-filter-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        loadApplications(1);
      });
      form.addEventListener('reset', () => {
        setTimeout(() => loadApplications(1), 0);
      });
    }

    const statusFilter = el('application-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => loadApplications(1));
    }

    loadApplications(1);
  }

  /* -----------------------------------------------------------------------
   * Start the correct page
   * -------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const user = await App.authReady;
    if (!user || user.role !== 'applicant') return;

    if (page === 'applicant-dashboard') initApplicantDashboard();
    else if (page === 'profile') initApplicantProfile();
    else if (page === 'applications') initApplications();
  });
})();
