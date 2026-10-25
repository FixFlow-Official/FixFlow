const notificationModel = require("../models/notification.model");
const { sendPushNotifications } = require("./webPush.service");

async function createNotifications(entries) {
  const validEntries = entries.filter((entry) => entry?.recipient && entry?.recipientRef);
  if (validEntries.length === 0) return;

  let savedNotifications;
  try {
    savedNotifications = await notificationModel.insertMany(validEntries, { ordered: false });
  } catch (error) {
    // Notification delivery must never undo an already-saved complaint action.
    console.error("Could not persist one or more in-app notifications:", error);
    return;
  }

  try {
    await sendPushNotifications(savedNotifications);
  } catch (error) {
    console.error("Could not send one or more device notifications:", error);
  }
}

function complaintNotification({ recipient, recipientRef, complaint, type, title, message }) {
  return {
    recipient,
    recipientRef,
    complaint: complaint._id,
    complaintTitle: complaint.complaintTitle || "Complaint",
    type,
    title,
    message,
  };
}

module.exports = { createNotifications, complaintNotification };
