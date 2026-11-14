// js/api.js
// Shared helpers used by every page. No frameworks, only the Fetch API.
(function () {
  'use strict';

  const TOKEN_KEY = 'jsm_token';
  const USER_KEY = 'jsm_user';
  const API_ORIGIN = window.location.port === '5000'
    ? window.location.origin
    : 'http://localhost:5000';
  const API_BASE = `${API_ORIGIN}/api`;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    saveUser(user);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function dashboardFor(role) {
    return role === 'recruiter' ? 'recruiter-dashboard.html' : 'applicant-dashboard.html';
  }

  /**
   * Wrapper around fetch that adds JSON headers and the JWT token.
   * Throws an Error with .status and .data when the API responds with an error.
   */
  async function api(path, options = {}) {
    const {
      method = 'GET',
      body,
      auth = true,
      redirectOn401 = true,
      headers: extraHeaders = {},
    } = options;

    const headers = { ...extraHeaders };
    const token = getToken();

    if (auth && token) headers.Authorization = `Bearer ${token}`;

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
      });
    } catch (networkError) {
      const error = new Error('Cannot reach the server. Make sure the backend is running on port 5000.');
      error.status = 0;
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message = (data && data.message) || `Request failed with status ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;

      if (response.status === 401 && auth && redirectOn401) {
        clearSession();
        const page = window.location.pathname.split('/').pop() || 'index.html';
        if (!['login.html', 'register.html'].includes(page)) {
          window.location.href = 'login.html?expired=1';
        }
      }

      throw error;
    }

    return data;
  }

  /** Download a protected file using the JWT header, then save it through a blob URL. */
  async function downloadFile(apiPath, fallbackName = 'resume.pdf') {
    const url = apiPath.startsWith('/api') ? `${API_ORIGIN}${apiPath}` : `${API_BASE}${apiPath}`;
    let response;
    try {
      response = await fetch(url, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      });
    } catch (error) {
      throw new Error('Cannot reach the server. Make sure the backend is running.');
    }

    if (!response.ok) {
      let message = 'Could not download the file.';
      try {
        const data = await response.json();
        message = data.message || message;
      } catch (error) {
        // Response was not JSON.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value, includeTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  }

  function relativeTime(value) {
    if (!value) return '';
    const date = new Date(value).getTime();
    if (Number.isNaN(date)) return '';
    const seconds = Math.round((date - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const ranges = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unit, size] of ranges) {
      if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  function statusClass(status) {
    return String(status || '').toLowerCase().replace(/\s+/g, '-');
  }

  function statusBadge(status) {
    return `<span class="badge status-${escapeHtml(statusClass(status))}">${escapeHtml(status || 'Unknown')}</span>`;
  }

  function skillChips(skills, type = 'default', max = Infinity) {
    const list = Array.isArray(skills) ? skills : [];
    if (list.length === 0) return '<span class="muted">No skills available</span>';
    const visible = list.slice(0, max);
    const remaining = list.length - visible.length;
    return `${visible
      .map((skill) => `<span class="skill-chip skill-${escapeHtml(type)}">${escapeHtml(skill)}</span>`)
      .join('')}${remaining > 0 ? `<span class="skill-chip skill-more">+${remaining} more</span>` : ''}`;
  }

  function parseSkillList(value) {
    const seen = new Set();
    return String(value || '')
      .split(/[,\n;]/)
      .map((skill) => skill.trim().replace(/\s+/g, ' ').slice(0, 50))
      .filter((skill) => {
        if (!skill) return false;
        const key = skill.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 60);
  }

  function setProgressRing(element, value) {
    if (!element) return;
    const safeValue = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    let color = '#ef4444';
    if (safeValue >= 75) color = '#16a34a';
    else if (safeValue >= 50) color = '#2563eb';
    else if (safeValue >= 25) color = '#f59e0b';

    element.style.setProperty('--value', safeValue);
    element.style.setProperty('--ring-color', color);
    element.innerHTML = `<span class="match-ring-value">${safeValue}%</span>`;
    element.setAttribute('aria-label', `Match score ${safeValue} percent`);
  }

  function setButtonLoading(button, loading, loadingText = 'Please wait...') {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner spinner-small"></span>${escapeHtml(loadingText)}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function showToast(message, type = 'info', title = '') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const iconMap = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info',
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${iconMap[type] || iconMap.info}"></i>
      <div class="toast-content">
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
        <span>${escapeHtml(message)}</span>
      </div>
      <button type="button" class="toast-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const remove = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    };
    toast.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, 4500);
  }

  function showModal(id) {
    const modal = document.querySelector(`#${id}`);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function hideModal(id) {
    const modal = document.querySelector(`#${id}`);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal-overlay.open')) {
      document.body.classList.remove('modal-open');
    }
  }

  /** Promise-based confirmation dialog with the same look as the rest of the UI. */
  function confirmAction({ title = 'Please confirm', message = 'Are you sure?', confirmText = 'Confirm', danger = true }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay open';
      overlay.innerHTML = `
        <div class="modal modal-small" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <h2>${escapeHtml(title)}</h2>
            </div>
            <button type="button" class="icon-button" data-cancel aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-message">${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" data-cancel>Cancel</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');

      const close = (result) => {
        overlay.remove();
        if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
        resolve(result);
      };
      overlay.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => close(false)));
      overlay.querySelector('[data-confirm]').addEventListener('click', () => close(true));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close(false);
      });
    });
  }

  /**
   * Render simple Previous / page numbers / Next pagination.
   * onPage is called with the requested page number.
   */
  function renderPagination(container, pagination, onPage) {
    if (!container) return;
    if (!pagination || pagination.total === 0) {
      container.innerHTML = '';
      return;
    }

    const { page, totalPages } = pagination;
    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    if (page <= 3) [2, 3, 4].forEach((item) => pages.add(item));
    if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((item) => pages.add(item));
    const sorted = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);

    let previous = 0;
    const pageButtons = sorted.map((item) => {
      const gap = item - previous > 1 ? '<span class="page-ellipsis">…</span>' : '';
      previous = item;
      return `${gap}<button type="button" class="page-btn ${item === page ? 'active' : ''}" data-page="${item}">${item}</button>`;
    }).join('');

    container.innerHTML = `
      <button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      ${pageButtons}
      <button type="button" class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    container.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextPage = Number(button.dataset.page);
        if (nextPage >= 1 && nextPage <= totalPages && nextPage !== page) onPage(nextPage);
      });
    });
  }

  function debounce(fn, delay = 350) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  window.App = {
    API_ORIGIN,
    API_BASE,
    getToken,
    getUser,
    saveUser,
    saveSession,
    clearSession,
    dashboardFor,
    api,
    downloadFile,
    escapeHtml,
    formatDate,
    relativeTime,
    formatFileSize,
    initials,
    statusBadge,
    skillChips,
    parseSkillList,
    setProgressRing,
    setButtonLoading,
    showToast,
    showModal,
    hideModal,
    confirmAction,
    renderPagination,
    debounce,
    getQueryParam,
  };
})();
