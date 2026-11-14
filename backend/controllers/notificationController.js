// controllers/notificationController.js
const Notification = require('../models/Notification');
const { isValidObjectId, parsePagination, buildPagination } = require('../utils/validators');

// GET /api/notifications
async function getMyNotifications(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { user: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/notifications/:id/read
async function markNotificationRead(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/notifications/read-all
async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMyNotifications, markNotificationRead, markAllNotificationsRead };
