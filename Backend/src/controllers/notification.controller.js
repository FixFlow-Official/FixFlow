const mongoose = require("mongoose");
const notificationModel = require("../models/notification.model");

function recipientFilter(req) {
  return { recipient: req.auth.id, recipientRef: req.auth.role };
}

async function listNotifications(req, res) {
  try {
    const filter = recipientFilter(req);
    const [notifications, unreadCount] = await Promise.all([
      notificationModel.find(filter).sort({ createdAt: -1 }).limit(30).lean(),
      notificationModel.countDocuments({ ...filter, readAt: null }),
    ]);
    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error("listNotifications failed:", error);
    return res.status(500).json({ message: "Could not load notifications." });
  }
}

async function markNotificationRead(req, res) {
  if (!mongoose.isValidObjectId(req.params.notificationId)) {
    return res.status(400).json({ message: "Invalid notification ID." });
  }
  try {
    const notification = await notificationModel.findOneAndUpdate(
      { _id: req.params.notificationId, ...recipientFilter(req) },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }
    return res.status(200).json({ notification });
  } catch (error) {
    console.error("markNotificationRead failed:", error);
    return res.status(500).json({ message: "Could not update the notification." });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    const result = await notificationModel.updateMany(
      { ...recipientFilter(req), readAt: null },
      { $set: { readAt: new Date() } },
    );
    return res.status(200).json({ updatedCount: result.modifiedCount });
  } catch (error) {
    console.error("markAllNotificationsRead failed:", error);
    return res.status(500).json({ message: "Could not update notifications." });
  }
}

module.exports = { listNotifications, markNotificationRead, markAllNotificationsRead };
