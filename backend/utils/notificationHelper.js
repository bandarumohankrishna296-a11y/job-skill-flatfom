// utils/notificationHelper.js
// Small helper so controllers do not repeat notification creation code.
const Notification = require('../models/Notification');

async function notifyUser({ user, type, title, message, application = null }) {
  try {
    await Notification.create({ user, type, title, message, application });
  } catch (error) {
    // A notification failure should not break the main action (e.g. applying).
    console.error('Could not create notification:', error.message);
  }
}

module.exports = { notifyUser };
