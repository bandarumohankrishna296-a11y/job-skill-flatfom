// js/recruiter.js
// Page controller for the recruiter workspace: dashboard, job CRUD,
// candidate search, applications and status management.
(function () {
  'use strict';

  const STATUS_ORDER = ['Pending', 'Shortlisted', 'Accepted', 'Rejected'];
  const STATUS_COLORS = {
    Pending: '#f59e0b',
    Shortlisted: '#0ea5e9',
    Accepted: '#16a34a',
    Rejected: '#ef4444',
  };
  const COMMON_SKILLS = [
    'Python', 'Java', 'JavaScript', 'C', 'C++', 'HTML', 'CSS', 'React', 'Node.js',
    'Express.js', 'MongoDB', 'MySQL', 'SQL', 'PostgreSQL', 'Git', 'GitHub', 'AWS',
    'Docker', 'Machine Learning', 'Deep Learning', 'Data Science', 'Power BI',
    'Tableau', 'Excel', 'REST API', 'Flask', 'Django', 'PHP', 'Angular', 'TypeScript',
  ];
  const TAB_TITLES = {
    overview: 'Overview',
    jobs: 'My jobs',
    candidates: 'Candidates',
    applications: 'Applications',
  };

  let statusChart = null;
  let allJobs = [];
  let currentJobs = [];
  let selectedSkills = [];
  let pickerBuilt = false;
  let initialTabLoaded = false;

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

  function statusOptions(selected) {
    return STATUS_ORDER.map((status) => (
      `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`
    )).join('');
  }

  function jobMeta(job) {
    return [job.company, job.location, job.jobType].filter(Boolean).join(' • ');
  }

  function renderRingCharts() {
    document.querySelectorAll('[data-ring-value]').forEach((ring) => {
      App.setProgressRing(ring, ring.dataset.ringValue);
    });
  }

  /* -----------------------------------------------------------------------
   * Tabs
   * -------------------------------------------------------------------- */
  function activateTab(tab, loadData = true) {
    const nextTab = TAB_TITLES[tab] ? tab : 'overview';

    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === nextTab);
    });
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tabPanel === nextTab);
    });
    document.querySelectorAll('[data-tab-link]').forEach((link) => {
      link.classList.toggle('active', link.dataset.tabLink === nextTab);
    });

    setText('recruiter-page-title', TAB_TITLES[nextTab]);
    window.history.replaceState(null, '', `#${nextTab}`);

    if (!loadData) return;
    if (nextTab === 'overview') loadRecruiterDashboard();
    else if (nextTab === 'jobs') loadRecruiterJobs(1);
    else if (nextTab === 'candidates') searchCandidates(1);
    else if (nextTab === 'applications') loadRecruiterApplications(1);
  }

  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => activateTab(button.dataset.tab));
    });
    document.querySelectorAll('[data-tab-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        activateTab(link.dataset.tabLink);
      });
    });
    document.querySelectorAll('[data-tab-jump]').forEach((button) => {
      button.addEventListener('click', () => activateTab(button.dataset.tabJump));
    });
  }

  /* -----------------------------------------------------------------------
   * Overview
   * -------------------------------------------------------------------- */
  function renderStatusChart(statusCounts) {
    const canvas = el('recruiter-status-chart');
    if (!canvas) return;

    const values = STATUS_ORDER.map((status) => Number(statusCounts[status]) || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    setText('recruiter-chart-total', total);

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

  function renderStatusLegend(statusCounts) {
    const container = el('recruiter-status-legend');
    if (!container) return;
    container.innerHTML = STATUS_ORDER.map((status) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${STATUS_COLORS[status]}"></span>
        <span>${status}</span>
        <strong>${Number(statusCounts[status]) || 0}</strong>
      </div>
    `).join('');
  }

  function renderRecentApplications(rows) {
    const body = el('recruiter-recent-body');
    if (!body) return;

    if (!rows || rows.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="table-empty"><i class="fa-regular fa-folder-open"></i> No applications received yet.</td></tr>';
      return;
    }

    body.innerHTML = rows.map((application) => {
      const candidate = application.applicant || {};
      const job = application.job || {};
      return `
        <tr>
          <td>
            <div class="user-cell">
              <span class="avatar">${App.initials(candidate.name)}</span>
              <div>
                <strong>${App.escapeHtml(candidate.name || 'Candidate')}</strong>
                <span>${App.escapeHtml(candidate.email || '')}</span>
              </div>
            </div>
          </td>
          <td>
            <div class="application-job-cell">
              <strong>${App.escapeHtml(job.title || 'Job')}</strong>
              <span>${App.escapeHtml(job.company || '')}</span>
            </div>
          </td>
          <td>${App.formatDate(application.appliedAt)}</td>
          <td><span class="match-pill ${matchClass(application.matchPercentage)}">${Number(application.matchPercentage) || 0}%</span></td>
          <td>${App.statusBadge(application.status)}</td>
        </tr>`;
    }).join('');
  }

  function renderTopJobs(topJobs) {
    const container = el('recruiter-top-jobs');
    if (!container) return;

    if (!topJobs || topJobs.length === 0) {
      container.innerHTML = '<p class="muted text-small">No applications yet. Share a job posting to start receiving candidates.</p>';
      return;
    }

    container.innerHTML = topJobs.map((job) => `
      <div class="mini-stat-row">
        <div>
          <strong>${App.escapeHtml(job.title)}</strong><br>
          <span>${App.escapeHtml(job.company)}${job.isActive ? '' : ' • closed'}</span>
        </div>
        <div class="text-right">
          <strong>${Number(job.applications) || 0}</strong>
          <span> applications</span>
        </div>
      </div>
    `).join('');
  }

  async function loadRecruiterDashboard() {
    try {
      const response = await App.api('/recruiter/dashboard');
      const data = response.data || {};
      const stats = data.stats || {};
      const counts = data.statusCounts || {};

      setText('recruiter-welcome-name', (data.user && data.user.name ? data.user.name.split(' ')[0] : 'Recruiter'));
      setText('recruiter-stat-jobs', stats.totalJobs || 0);
      setText('recruiter-stat-applicants', stats.totalApplicants || 0);
      setText('recruiter-stat-applications', stats.totalApplications || 0);
      setText('recruiter-stat-shortlisted', stats.shortlisted || 0);
      setText('recruiter-stat-pending', stats.pending || 0);
      setText('recruiter-stat-accepted', stats.accepted || 0);
      setText('tab-jobs-count', stats.totalJobs || 0);
      setText('tab-applications-count', stats.totalApplications || 0);

      renderRecentApplications(data.recentApplications);
      renderStatusChart(counts);
      renderStatusLegend(counts);
      renderTopJobs(data.topJobs);
    } catch (error) {
      App.showToast(error.message, 'error', 'Could not load dashboard');
    }
  }

  /* -----------------------------------------------------------------------
   * Job selection lists
   * -------------------------------------------------------------------- */
  function fillJobSelect(select, jobs, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` + jobs.map((job) => (
      `<option value="${job._id}">${App.escapeHtml(job.title)} — ${App.escapeHtml(job.company)}</option>`
    )).join('');
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  async function loadJobOptions() {
    try {
      const response = await App.api('/recruiter/jobs?limit=100');
      allJobs = response.data || [];
      fillJobSelect(el('candidate-job-select'), allJobs, 'No specific job');
      fillJobSelect(el('recruiter-filter-job'), allJobs, 'All jobs');
    } catch (error) {
      if (error.status !== 401) console.warn('Could not load job options:', error.message);
    }
  }

  /* -----------------------------------------------------------------------
   * Job management
   * -------------------------------------------------------------------- */
  function renderRecruiterJobs(jobs) {
    const container = el('recruiter-jobs-list');
    if (!container) return;

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-briefcase"></i>
          <h3>No job postings yet</h3>
          <p>Create your first opening to start receiving applications.</p>
          <button type="button" class="btn btn-primary btn-sm" data-open-job-modal>Post a job</button>
        </div>`;
      bindOpenJobButtons(container);
      return;
    }

    container.innerHTML = jobs.map((job) => `
      <article class="job-manage-item">
        <span class="company-avatar">${App.initials(job.company)}</span>
        <div class="job-manage-copy">
          <strong>${App.escapeHtml(job.title)}</strong>
          <span>${App.escapeHtml(jobMeta(job))}</span>
          <div class="skill-list mt-1">${App.skillChips(job.requiredSkills, 'default', 7)}</div>
          <div class="job-manage-stats">
            <span><strong>${Number(job.applicationCount) || 0}</strong> applications</span>
            <span><strong>${Number(job.shortlistedCount) || 0}</strong> shortlisted</span>
            <span><strong>${Number(job.acceptedCount) || 0}</strong> accepted</span>
            <span>${job.isActive ? '<span class="badge status-active">Active</span>' : '<span class="badge status-inactive">Closed</span>'}</span>
          </div>
        </div>
        <div class="job-manage-actions">
          <a class="btn btn-light btn-sm" href="job-details.html?id=${encodeURIComponent(job._id)}">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button type="button" class="btn btn-outline btn-sm" data-edit-job="${job._id}">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button type="button" class="btn btn-light btn-sm" data-toggle-job="${job._id}">
            <i class="fa-solid ${job.isActive ? 'fa-lock' : 'fa-lock-open'}"></i> ${job.isActive ? 'Close' : 'Reopen'}
          </button>
          <button type="button" class="btn btn-danger btn-sm" data-delete-job="${job._id}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </article>
    `).join('');
  }

  async function loadRecruiterJobs(page) {
    const search = el('recruiter-job-search');
    const params = new URLSearchParams({ page: Math.max(1, Number(page) || 1), limit: 8 });
    if (search && search.value.trim()) params.set('q', search.value.trim());

    const container = el('recruiter-jobs-list');
    if (container) container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading your job postings...</div>';

    try {
      const response = await App.api(`/recruiter/jobs?${params.toString()}`);
      currentJobs = response.data || [];
      renderRecruiterJobs(currentJobs);
      App.renderPagination(el('recruiter-jobs-pagination'), response.pagination, (nextPage) => {
        loadRecruiterJobs(nextPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (error) {
      if (container) container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${App.escapeHtml(error.message)}</p></div>`;
      App.showToast(error.message, 'error');
    }
  }

  /* -----------------------------------------------------------------------
   * Job create / edit modal
   * -------------------------------------------------------------------- */
  function showJobFormAlert(message, type) {
    const alertBox = el('job-form-alert');
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = `form-alert form-alert-${type || 'error'}`;
    alertBox.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${App.escapeHtml(message)}</span>`;
  }

  function hideJobFormAlert() {
    const alertBox = el('job-form-alert');
    if (alertBox) {
      alertBox.hidden = true;
      alertBox.textContent = '';
    }
  }

  function renderSelectedSkills() {
    const container = el('job-selected-skills');
    if (!container) return;

    if (selectedSkills.length === 0) {
      container.innerHTML = '';
      container.dataset.empty = 'true';
    } else {
      container.innerHTML = selectedSkills.map((skill) => `
        <span class="selected-skill">
          ${App.escapeHtml(skill)}
          <button type="button" data-remove-skill="${App.escapeHtml(skill)}" aria-label="Remove ${App.escapeHtml(skill)}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>
      `).join('');
    }

    if (pickerBuilt) {
      document.querySelectorAll('#job-skill-picker [data-skill-option]').forEach((button) => {
        button.classList.toggle(
          'selected',
          selectedSkills.some((skill) => skill.toLowerCase() === button.dataset.skillOption.toLowerCase())
        );
      });
    }
  }

  function buildSkillPicker() {
    const picker = el('job-skill-picker');
    if (!picker || pickerBuilt) return;
    picker.innerHTML = COMMON_SKILLS.map((skill) => (
      `<button type="button" data-skill-option="${App.escapeHtml(skill)}">${App.escapeHtml(skill)}</button>`
    )).join('');
    pickerBuilt = true;
  }

  function addSkill(value) {
    const skill = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!skill) return;
    if (selectedSkills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
      App.showToast(`${skill} is already selected.`, 'info');
      return;
    }
    if (selectedSkills.length >= 30) {
      App.showToast('A job can have at most 30 required skills.', 'warning');
      return;
    }
    selectedSkills.push(skill);
    renderSelectedSkills();
  }

  function removeSkill(value) {
    selectedSkills = selectedSkills.filter((skill) => skill.toLowerCase() !== String(value).toLowerCase());
    renderSelectedSkills();
  }

  function openJobModal(job) {
    const form = el('job-form');
    if (!form) return;

    form.reset();
    hideJobFormAlert();
    setText('job-modal-title', job ? 'Edit job posting' : 'Post a new job');
    setText('job-submit-label', job ? 'Save changes' : 'Post job');
    el('job-id').value = job ? job._id : '';

    if (job) {
      el('job-title').value = job.title || '';
      el('job-company').value = job.company || '';
      el('job-location').value = job.location || '';
      el('job-salary').value = job.salaryRange || '';
      el('job-category').value = job.category || 'Other';
      el('job-type').value = job.jobType || 'Full-time';
      el('job-experience').value = job.experienceLevel || 'Fresher';
      el('job-description').value = job.description || '';
      selectedSkills = Array.isArray(job.requiredSkills) ? [...job.requiredSkills] : [];
    } else {
      selectedSkills = [];
    }

    buildSkillPicker();
    renderSelectedSkills();
    App.showModal('job-modal');
    setTimeout(() => el('job-title').focus(), 120);
  }

  function bindOpenJobButtons(root) {
    (root || document).querySelectorAll('[data-open-job-modal]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => openJobModal(null));
    });
  }

  async function submitJob(event) {
    event.preventDefault();
    hideJobFormAlert();

    const jobId = el('job-id').value;
    const title = el('job-title').value.trim();
    const company = el('job-company').value.trim();
    const location = el('job-location').value.trim();
    const description = el('job-description').value.trim();

    if (title.length < 3) return showJobFormAlert('Job title must be at least 3 characters long.');
    if (company.length < 2) return showJobFormAlert('Company name is required.');
    if (location.length < 2) return showJobFormAlert('Location is required.');
    if (description.length < 30) return showJobFormAlert('Job description must be at least 30 characters long.');
    if (selectedSkills.length === 0) return showJobFormAlert('Add at least one required skill.');

    const body = {
      title,
      company,
      location,
      description,
      salaryRange: el('job-salary').value.trim(),
      category: el('job-category').value,
      jobType: el('job-type').value,
      experienceLevel: el('job-experience').value,
      requiredSkills: selectedSkills,
    };

    const submitButton = el('job-submit-button');
    App.setButtonLoading(submitButton, true, jobId ? 'Saving...' : 'Posting...');

    try {
      const response = await App.api(jobId ? `/jobs/${jobId}` : '/jobs', {
        method: jobId ? 'PUT' : 'POST',
        body,
      });
      App.showToast(response.message || 'Job saved successfully.', 'success');
      App.hideModal('job-modal');
      await Promise.all([loadRecruiterJobs(1), loadJobOptions(), loadRecruiterDashboard()]);
    } catch (error) {
      showJobFormAlert(error.message);
    } finally {
      App.setButtonLoading(submitButton, false);
    }
  }

  function bindJobModal() {
    const form = el('job-form');
    if (!form) return;

    form.addEventListener('submit', submitJob);

    document.querySelectorAll('[data-close-job-modal]').forEach((button) => {
      button.addEventListener('click', () => App.hideModal('job-modal'));
    });
    el('job-modal').addEventListener('click', (event) => {
      if (event.target.id === 'job-modal') App.hideModal('job-modal');
    });

    const skillsInput = el('job-skills-input');
    skillsInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        addSkill(skillsInput.value);
        skillsInput.value = '';
      }
    });
    skillsInput.addEventListener('blur', () => {
      if (skillsInput.value.trim()) {
        addSkill(skillsInput.value);
        skillsInput.value = '';
      }
    });

    el('job-skill-picker').addEventListener('click', (event) => {
      const button = event.target.closest('[data-skill-option]');
      if (!button) return;
      const skill = button.dataset.skillOption;
      if (selectedSkills.some((item) => item.toLowerCase() === skill.toLowerCase())) removeSkill(skill);
      else addSkill(skill);
    });

    el('job-selected-skills').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-skill]');
      if (button) removeSkill(button.dataset.removeSkill);
    });

    bindOpenJobButtons(document);
  }

  /* -----------------------------------------------------------------------
   * Candidate search
   * -------------------------------------------------------------------- */
  function candidateCell(candidate) {
    return `
      <div class="user-cell">
        <span class="avatar">${App.initials(candidate.name)}</span>
        <div>
          <strong>${App.escapeHtml(candidate.name)}</strong>
          <span>${App.escapeHtml(candidate.headline || candidate.email || '')}</span>
          ${candidate.location ? `<span>${App.escapeHtml(candidate.location)}</span>` : ''}
        </div>
      </div>`;
  }

  function resumeCell(resumeId, resumeName) {
    if (!resumeId) return '<span class="badge status-inactive">Not uploaded</span>';
    return `
      <div class="actions">
        <span class="badge status-accepted">Available</span>
        <button type="button" class="btn btn-light btn-sm" data-download-resume
          data-download-url="/api/resumes/${resumeId}/download"
          data-filename="${App.escapeHtml(resumeName || 'resume.pdf')}">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>`;
  }

  async function searchCandidates(page) {
    const params = new URLSearchParams({ page: Math.max(1, Number(page) || 1), limit: 10 });
    const keyword = el('candidate-search-input').value.trim();
    const jobId = el('candidate-job-select').value;
    if (keyword) params.set('q', keyword);
    if (jobId) params.set('jobId', jobId);

    const body = el('candidate-body');
    if (body) body.innerHTML = '<tr><td colspan="5" class="table-empty"><span class="spinner"></span><br>Searching candidates...</td></tr>';

    try {
      const response = await App.api(`/recruiter/candidates?${params.toString()}`);
      const rows = response.data || [];
      const hasJob = Boolean(response.selectedJob);

      const matchHeader = el('candidate-match-header');
      if (matchHeader) matchHeader.hidden = !hasJob;
      setText('candidate-count', `${response.pagination ? response.pagination.total : rows.length} candidate${rows.length === 1 ? '' : 's'} found`);
      setText('candidate-match-note', response.selectedJob
        ? `Match scores are calculated against "${response.selectedJob.title}".`
        : '');

      if (!body) return;

      if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-user-slash"></i> No candidates match this search.</td></tr>';
      } else {
        body.innerHTML = rows.map((candidate) => `
          <tr>
            <td>${candidateCell(candidate)}</td>
            <td class="candidate-skills">${App.skillChips(candidate.skills, 'extracted', 6)}</td>
            <td>${resumeCell(candidate.resumeId, candidate.resumeName)}</td>
            <td ${hasJob ? '' : 'hidden'}>
              <span class="match-pill ${matchClass(candidate.matchPercentage)}">${Number(candidate.matchPercentage) || 0}%</span>
            </td>
            <td>
              <button type="button" class="btn btn-light btn-sm" data-view-candidate="${candidate._id}">
                <i class="fa-regular fa-eye"></i> Profile
              </button>
            </td>
          </tr>
        `).join('');
      }

      App.renderPagination(el('candidate-pagination'), response.pagination, (nextPage) => {
        searchCandidates(nextPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (error) {
      if (body) body.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-triangle-exclamation"></i> ${App.escapeHtml(error.message)}</td></tr>`;
      App.showToast(error.message, 'error');
    }
  }

  async function openCandidateDetails(applicantId) {
    try {
      const response = await App.api(`/recruiter/candidates/${applicantId}`);
      const { candidate, resume, applications } = response.data;

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal modal-medium" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <h2>Candidate profile</h2>
              <p>Only visible because this candidate applied to one of your jobs.</p>
            </div>
            <button type="button" class="icon-button" data-close-detail aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="candidate-detail-head">
              <span class="avatar lg">${App.initials(candidate.name)}</span>
              <div>
                <h3>${App.escapeHtml(candidate.name)}</h3>
                <p>${App.escapeHtml(candidate.headline || 'Applicant')}</p>
                <p class="muted">${App.escapeHtml(candidate.email)}${candidate.location ? ` • ${App.escapeHtml(candidate.location)}` : ''}</p>
              </div>
            </div>

            <div class="skills-block">
              <div class="skills-block-head">
                <h4><i class="fa-solid fa-code"></i> Skills</h4>
                ${resume && resume.id
                  ? `<button type="button" class="btn btn-light btn-sm" data-download-resume
                       data-download-url="${resume.downloadUrl}"
                       data-filename="${App.escapeHtml(resume.originalName || 'resume.pdf')}">
                       <i class="fa-solid fa-download"></i> Download resume
                     </button>`
                  : ''}
              </div>
              <div class="skill-list">${App.skillChips(resume ? resume.skills : [], 'extracted')}</div>
              <p class="text-small muted mt-1">${resume ? App.escapeHtml(resume.originalName) : 'No resume uploaded.'}</p>
            </div>

            <div class="skills-block">
              <div class="skills-block-head"><h4><i class="fa-solid fa-clipboard-list"></i> Applications to your jobs</h4></div>
              <div class="candidate-app-list">
                ${applications.map((application) => `
                  <div class="candidate-app-item">
                    <div>
                      <strong>${App.escapeHtml(application.job ? application.job.title : 'Job')}</strong>
                      <span>${App.escapeHtml(application.job ? application.job.company : '')} • Applied ${App.formatDate(application.appliedAt)}</span>
                    </div>
                    <div class="actions">
                      <span class="match-pill ${matchClass(application.matchPercentage)}">${Number(application.matchPercentage) || 0}%</span>
                      ${App.statusBadge(application.status)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" data-close-detail>Close</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');
      requestAnimationFrame(() => overlay.classList.add('open'));

      const close = () => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 180);
        if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
      };
      overlay.querySelectorAll('[data-close-detail]').forEach((button) => button.addEventListener('click', close));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
      });
    } catch (error) {
      if (error.status === 403) {
        App.showToast(error.message, 'warning', 'Profile is private');
      } else {
        App.showToast(error.message, 'error');
      }
    }
  }

  /* -----------------------------------------------------------------------
   * Applications
   * -------------------------------------------------------------------- */
  async function loadRecruiterApplications(page) {
    const params = new URLSearchParams({ page: Math.max(1, Number(page) || 1), limit: 10 });
    const jobId = el('recruiter-filter-job').value;
    const status = el('recruiter-filter-status').value;
    if (jobId) params.set('jobId', jobId);
    if (status) params.set('status', status);

    const body = el('recruiter-applications-body');
    if (body) body.innerHTML = '<tr><td colspan="6" class="table-empty"><span class="spinner"></span><br>Loading applications...</td></tr>';

    try {
      const response = await App.api(`/recruiter/applications?${params.toString()}`);
      const rows = response.data || [];

      if (!body) return;

      if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="table-empty"><i class="fa-regular fa-folder-open"></i> No applications match these filters.</td></tr>';
      } else {
        body.innerHTML = rows.map((application) => {
          const candidate = application.applicant || {};
          const job = application.job || {};
          const resume = application.resume;
          return `
            <tr>
              <td>
                <div class="user-cell">
                  <span class="avatar">${App.initials(candidate.name)}</span>
                  <div>
                    <strong>${App.escapeHtml(candidate.name || 'Candidate')}</strong>
                    <span>${App.escapeHtml(candidate.email || '')}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="application-job-cell">
                  <strong>${App.escapeHtml(job.title || 'Job')}</strong>
                  <span>${App.escapeHtml(job.company || '')}</span>
                </div>
              </td>
              <td>${App.formatDate(application.appliedAt)}</td>
              <td><span class="match-pill ${matchClass(application.matchPercentage)}">${Number(application.matchPercentage) || 0}%</span></td>
              <td>${resume
                ? `<button type="button" class="btn btn-light btn-sm" data-download-resume
                     data-download-url="${resume.downloadUrl}"
                     data-filename="${App.escapeHtml(resume.originalName || 'resume.pdf')}">
                     <i class="fa-solid fa-download"></i> Resume
                   </button>`
                : '<span class="badge status-inactive">None</span>'}</td>
              <td>
                <select class="status-select status-${App.escapeHtml(String(application.status).toLowerCase())}"
                  data-status-select data-application-id="${application._id}"
                  aria-label="Update application status">
                  ${statusOptions(application.status)}
                </select>
              </td>
            </tr>`;
        }).join('');
      }

      App.renderPagination(el('recruiter-applications-pagination'), response.pagination, (nextPage) => {
        loadRecruiterApplications(nextPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (error) {
      if (body) body.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fa-solid fa-triangle-exclamation"></i> ${App.escapeHtml(error.message)}</td></tr>`;
      App.showToast(error.message, 'error');
    }
  }

  async function changeApplicationStatus(select) {
    const applicationId = select.dataset.applicationId;
    const status = select.value;
    select.disabled = true;

    try {
      const response = await App.api(`/applications/${applicationId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      select.className = `status-select status-${status.toLowerCase()}`;
      App.showToast(response.message || `Status changed to ${status}.`, 'success');
      loadRecruiterDashboard();
    } catch (error) {
      App.showToast(error.message, 'error');
      loadRecruiterApplications(1);
    } finally {
      select.disabled = false;
    }
  }

  /* -----------------------------------------------------------------------
   * Event wiring
   * -------------------------------------------------------------------- */
  function bindEvents() {
    const jobSearch = el('recruiter-job-search');
    if (jobSearch) {
      jobSearch.addEventListener('input', App.debounce(() => loadRecruiterJobs(1), 350));
    }

    const jobsList = el('recruiter-jobs-list');
    if (jobsList) {
      jobsList.addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit-job]');
        if (editButton) {
          const job = currentJobs.find((item) => String(item._id) === editButton.dataset.editJob);
          if (job) openJobModal(job);
          return;
        }

        const toggleButton = event.target.closest('[data-toggle-job]');
        if (toggleButton) {
          const job = currentJobs.find((item) => String(item._id) === toggleButton.dataset.toggleJob);
          if (!job) return;
          try {
            await App.api(`/jobs/${job._id}`, {
              method: 'PUT',
              body: { isActive: !job.isActive },
            });
            App.showToast(job.isActive ? 'Job closed successfully.' : 'Job reopened successfully.', 'success');
            await loadRecruiterJobs(1);
            await loadJobOptions();
          } catch (error) {
            App.showToast(error.message, 'error');
          }
          return;
        }

        const deleteButton = event.target.closest('[data-delete-job]');
        if (deleteButton) {
          const job = currentJobs.find((item) => String(item._id) === deleteButton.dataset.deleteJob);
          if (!job) return;
          const confirmed = await App.confirmAction({
            title: 'Delete job posting?',
            message: `"${job.title}" will be hidden from applicants. Existing applications and their history remain in the database.`,
            confirmText: 'Delete job',
          });
          if (!confirmed) return;
          try {
            await App.api(`/jobs/${job._id}`, { method: 'DELETE' });
            App.showToast('Job posting deleted successfully.', 'success');
            await loadRecruiterJobs(1);
            await loadJobOptions();
            await loadRecruiterDashboard();
          } catch (error) {
            App.showToast(error.message, 'error');
          }
        }
      });
    }

    const candidateForm = el('candidate-search-form');
    if (candidateForm) {
      candidateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        searchCandidates(1);
      });
    }
    const candidateJobSelect = el('candidate-job-select');
    if (candidateJobSelect) candidateJobSelect.addEventListener('change', () => searchCandidates(1));

    const applicationFilter = el('recruiter-application-filter');
    if (applicationFilter) {
      applicationFilter.addEventListener('submit', (event) => {
        event.preventDefault();
        loadRecruiterApplications(1);
      });
    }

    document.addEventListener('click', async (event) => {
      const viewButton = event.target.closest('[data-view-candidate]');
      if (viewButton) {
        openCandidateDetails(viewButton.dataset.viewCandidate);
        return;
      }

      const resumeButton = event.target.closest('[data-download-resume]');
      if (resumeButton) {
        event.preventDefault();
        try {
          await App.downloadFile(resumeButton.dataset.downloadUrl, resumeButton.dataset.filename || 'resume.pdf');
        } catch (error) {
          App.showToast(error.message, 'error');
        }
      }
    });

    document.addEventListener('change', (event) => {
      const select = event.target.closest('[data-status-select]');
      if (select) changeApplicationStatus(select);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await App.authReady;
    if (!user || user.role !== 'recruiter') return;

    bindTabs();
    bindJobModal();
    bindEvents();

    const initialTab = TAB_TITLES[window.location.hash.replace('#', '')]
      ? window.location.hash.replace('#', '')
      : 'overview';

    await Promise.all([loadRecruiterDashboard(), loadJobOptions()]);

    if (initialTab !== 'overview') {
      activateTab(initialTab, true);
      initialTabLoaded = true;
    } else {
      activateTab('overview', false);
    }
  });
})();
