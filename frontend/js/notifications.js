// js/notifications.js
// In-app notification bell and dropdown.
(function () {
  'use strict';

  function iconFor(type) {
    if (type === 'application_status') return 'fa-clipboard-check';
    if (type === 'new_application') return 'fa-user-plus';
    if (type === 'application_submitted') return 'fa-paper-plane';
    return 'fa-bell';
  }

  async function loadNotifications(state) {
    try {
      const response = await App.api('/notifications?limit=8', { redirectOn401: false });
      state.unread = response.unreadCount;
      render(state, response.data);
    } catch (error) {
      if (error.status !== 401) console.warn('Could not load notifications:', error.message);
    }
  }

  function render(state, notifications) {
    const badge = state.container.querySelector('.notification-badge');
    if (badge) {
      badge.textContent = state.unread > 9 ? '9+' : String(state.unread);
      badge.hidden = state.unread === 0;
    }

    const list = state.container.querySelector('.notification-list');
    if (!list) return;

    if (!notifications || notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          <i class="fa-regular fa-bell-slash"></i>
          <p>No notifications yet.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = notifications.map((item) => `
      <button type="button" class="notification-item ${item.isRead ? '' : 'unread'}" data-notification-id="${item._id}">
        <span class="notification-icon type-${App.escapeHtml(item.type)}">
          <i class="fa-solid ${iconFor(item.type)}"></i>
        </span>
        <span class="notification-copy">
          <strong>${App.escapeHtml(item.title)}</strong>
          <span>${App.escapeHtml(item.message)}</span>
          <small>${App.relativeTime(item.createdAt)}</small>
        </span>
        ${item.isRead ? '' : '<span class="unread-dot"></span>'}
      </button>
    `).join('');

    list.querySelectorAll('[data-notification-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!button.classList.contains('unread')) return;
        try {
          await App.api(`/notifications/${button.dataset.notificationId}/read`, { method: 'PATCH' });
          button.classList.remove('unread');
          const dot = button.querySelector('.unread-dot');
          if (dot) dot.remove();
          state.unread = Math.max(0, state.unread - 1);
          const badge = state.container.querySelector('.notification-badge');
          if (badge) {
            badge.textContent = state.unread > 9 ? '9+' : String(state.unread);
            badge.hidden = state.unread === 0;
          }
        } catch (error) {
          App.showToast(error.message, 'error');
        }
      });
    });
  }

  async function initNotifications() {
    const container = document.querySelector('[data-notification-bell]');
    if (!container) return;

    const state = { container, unread: 0, open: false };
    const toggle = container.querySelector('.notification-button');
    const dropdown = container.querySelector('.notification-dropdown');

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      state.open = !state.open;
      dropdown.hidden = !state.open;
      container.classList.toggle('active', state.open);
    });

    dropdown.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', () => {
      if (!state.open) return;
      state.open = false;
      dropdown.hidden = true;
      container.classList.remove('active');
    });

    const markAll = dropdown.querySelector('[data-mark-all]');
    if (markAll) {
      markAll.addEventListener('click', async () => {
        try {
          await App.api('/notifications/read-all', { method: 'PATCH' });
          state.unread = 0;
          container.querySelectorAll('.notification-item.unread').forEach((item) => {
            item.classList.remove('unread');
            const dot = item.querySelector('.unread-dot');
            if (dot) dot.remove();
          });
          const badge = container.querySelector('.notification-badge');
          if (badge) badge.hidden = true;
          App.showToast('All notifications marked as read.', 'success');
        } catch (error) {
          App.showToast(error.message, 'error');
        }
      });
    }

    await loadNotifications(state);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await App.authReady;
    if (!user) return;
    await initNotifications();
  });
})();
