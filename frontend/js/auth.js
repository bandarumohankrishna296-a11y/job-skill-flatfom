// js/auth.js
// Handles registration, login, logout, page protection and the profile form.
(function () {
  'use strict';

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const isLoginPage = page === 'login.html';
  const isRegisterPage = page === 'register.html';

  function redirectToLogin() {
    const current = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search}`;
    window.location.href = `login.html?redirect=${encodeURIComponent(current)}`;
  }

  function safeRedirect(user) {
    const requested = App.getQueryParam('redirect');
    if (requested && !requested.includes('://') && !requested.startsWith('//')) {
      return requested;
    }
    return App.dashboardFor(user.role);
  }

  async function loadCurrentUser() {
    if (!App.getToken()) return null;
    try {
      const response = await App.api('/auth/me', { redirectOn401: false });
      App.saveUser(response.user);
      return response.user;
    } catch (error) {
      if (error.status === 401) App.clearSession();
      return null;
    }
  }

  function updateCommonUI(user) {
    document.querySelectorAll('[data-user-name]').forEach((element) => {
      element.textContent = user ? user.name : '';
    });
    document.querySelectorAll('[data-user-email]').forEach((element) => {
      element.textContent = user ? user.email : '';
    });
    document.querySelectorAll('[data-user-role]').forEach((element) => {
      element.textContent = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
    });
    document.querySelectorAll('[data-user-avatar]').forEach((element) => {
      element.textContent = user ? App.initials(user.name) : '?';
    });
    document.querySelectorAll('[data-dashboard-link]').forEach((link) => {
      link.href = user ? App.dashboardFor(user.role) : 'login.html';
    });
    document.querySelectorAll('[data-auth-only]').forEach((element) => {
      element.hidden = !user;
    });
    document.querySelectorAll('[data-guest-only]').forEach((element) => {
      element.hidden = Boolean(user);
    });

    if (user) {
      document.body.dataset.userRole = user.role;
      document.querySelectorAll('[data-applicant-only]').forEach((element) => {
        element.hidden = user.role !== 'applicant';
      });
    }
  }

  function bindLogoutButtons() {
    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        App.clearSession();
        window.location.href = 'index.html';
      });
    });
  }

  function bindMobileNavigation() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('[data-sidebar-overlay]');
    const toggle = document.querySelector('[data-sidebar-toggle]');
    if (!sidebar) return;

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    };

    if (toggle) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
      });
    }
    if (overlay) overlay.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) closeSidebar();
      });
    });

    const publicToggle = document.querySelector('[data-nav-toggle]');
    const publicLinks = document.querySelector('.public-nav-links');
    if (publicToggle && publicLinks) {
      publicToggle.addEventListener('click', () => publicLinks.classList.toggle('open'));
    }
  }

  function showFormAlert(element, message, type = 'error') {
    if (!element) return;
    element.className = `form-alert form-alert-${type}`;
    element.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${App.escapeHtml(message)}</span>`;
    element.hidden = false;
  }

  function hideFormAlert(element) {
    if (!element) return;
    element.hidden = true;
    element.textContent = '';
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
        button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  function initLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    const alertBox = document.getElementById('login-alert');
    if (App.getQueryParam('expired')) {
      showFormAlert(alertBox, 'Your session expired. Please log in again.', 'warning');
    }
    if (App.getQueryParam('registered')) {
      showFormAlert(alertBox, 'Account created successfully. Please log in.', 'success');
    }

    document.querySelectorAll('[data-demo-email]').forEach((button) => {
      button.addEventListener('click', () => {
        const email = document.getElementById('login-email');
        const password = document.getElementById('login-password');
        if (email) email.value = button.dataset.demoEmail;
        if (password) password.value = button.dataset.demoPassword;
        showFormAlert(alertBox, `${button.dataset.demoRole} demo credentials filled in. Click Sign in.`, 'success');
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideFormAlert(alertBox);

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      if (!email || !password) {
        showFormAlert(alertBox, 'Please enter your email and password.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      App.setButtonLoading(submitButton, true, 'Signing in...');

      try {
        const response = await App.api('/auth/login', {
          method: 'POST',
          body: { email, password },
          auth: false,
          redirectOn401: false,
        });
        App.saveSession(response.token, response.user);
        App.showToast(response.message || 'Login successful.', 'success');
        setTimeout(() => {
          window.location.href = safeRedirect(response.user);
        }, 400);
      } catch (error) {
        showFormAlert(alertBox, error.message);
        App.setButtonLoading(submitButton, false);
      }
    });
  }

  function initRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) return;
    const alertBox = document.getElementById('register-alert');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideFormAlert(alertBox);

      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm').value;
      const roleInput = form.querySelector('input[name="role"]:checked');
      const role = roleInput ? roleInput.value : '';

      if (!name || name.length < 2) {
        showFormAlert(alertBox, 'Please enter your full name.');
        return;
      }
      if (!email) {
        showFormAlert(alertBox, 'Please enter your email address.');
        return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        showFormAlert(alertBox, 'Password must be at least 8 characters and include a letter and a number.');
        return;
      }
      if (password !== confirmPassword) {
        showFormAlert(alertBox, 'Password and confirm password do not match.');
        return;
      }
      if (!['applicant', 'recruiter'].includes(role)) {
        showFormAlert(alertBox, 'Please choose whether you are an applicant or a recruiter.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      App.setButtonLoading(submitButton, true, 'Creating account...');

      try {
        const response = await App.api('/auth/register', {
          method: 'POST',
          body: { name, email, password, confirmPassword, role },
          auth: false,
          redirectOn401: false,
        });
        App.saveSession(response.token, response.user);
        App.showToast(response.message || 'Account created successfully.', 'success');
        setTimeout(() => {
          window.location.href = App.dashboardFor(response.user.role);
        }, 450);
      } catch (error) {
        showFormAlert(alertBox, error.message);
        App.setButtonLoading(submitButton, false);
      }
    });
  }

  function initProfileForm(user) {
    const form = document.getElementById('profile-form');
    if (!form || !user) return;

    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const headlineInput = document.getElementById('profile-headline');
    const locationInput = document.getElementById('profile-location');
    const alertBox = document.getElementById('profile-alert');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (headlineInput) headlineInput.value = user.headline || '';
    if (locationInput) locationInput.value = user.location || '';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideFormAlert(alertBox);
      const name = nameInput.value.trim();
      if (name.length < 2) {
        showFormAlert(alertBox, 'Name must be at least 2 characters long.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      App.setButtonLoading(submitButton, true, 'Saving...');
      try {
        const response = await App.api('/auth/profile', {
          method: 'PATCH',
          body: {
            name,
            headline: headlineInput ? headlineInput.value.trim() : '',
            location: locationInput ? locationInput.value.trim() : '',
          },
        });
        App.saveUser(response.user);
        updateCommonUI(response.user);
        showFormAlert(alertBox, response.message || 'Profile updated.', 'success');
        App.showToast('Profile updated successfully.', 'success');
      } catch (error) {
        showFormAlert(alertBox, error.message);
      } finally {
        App.setButtonLoading(submitButton, false);
      }
    });
  }

  async function initAuth() {
    const body = document.body;
    const requiresAuth = body.dataset.requireAuth === 'true' || Boolean(body.dataset.requireRole);
    const requiredRole = body.dataset.requireRole || '';
    let user = App.getUser();

    if (requiresAuth) {
      if (!App.getToken()) {
        redirectToLogin();
        return null;
      }

      user = await loadCurrentUser();
      if (!user) {
        redirectToLogin();
        return null;
      }

      if (requiredRole && user.role !== requiredRole) {
        App.showToast('You do not have permission to open that page.', 'warning');
        window.location.href = App.dashboardFor(user.role);
        return null;
      }
    } else if ((isLoginPage || isRegisterPage) && App.getToken()) {
      const existingUser = await loadCurrentUser();
      if (existingUser) {
        window.location.href = App.dashboardFor(existingUser.role);
        return null;
      }
    }

    updateCommonUI(user);
    bindLogoutButtons();
    bindMobileNavigation();
    bindPasswordToggles();

    if (isLoginPage) initLoginForm();
    if (isRegisterPage) initRegisterForm();
    if (user) initProfileForm(user);

    return user;
  }

  // Page scripts await this before contacting protected APIs.
  window.App.authReady = initAuth();
})();
