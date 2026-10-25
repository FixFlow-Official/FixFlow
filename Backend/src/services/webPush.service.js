const webPush = require("web-push");
const config = require("../config/config");
const pushSubscriptionModel = require("../models/pushSubscription.model");

const complaintPaths = {
  student: "/student/complaints",
  staff: "/staff/complaints",
  admin: "/admin/complaints",
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  webPush.setVapidDetails(
    config.VAPID_SUBJECT || "mailto:support@fixflow.app",
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
  return true;
}

async function sendPushNotifications(notifications) {
  if (!configureVapid() || notifications.length === 0) return;

  const recipients = notifications.map(({ recipient, recipientRef }) => ({ recipient, recipientRef }));
  const subscriptions = await pushSubscriptionModel.find({ $or: recipients }).lean();
  if (subscriptions.length === 0) return;

  const notificationByRecipient = new Map(
    notifications.map((item) => [`${item.recipientRef}:${item.recipient}`, item]),
  );

  await Promise.all(subscriptions.map(async (subscription) => {
    const notification = notificationByRecipient.get(`${subscription.recipientRef}:${subscription.recipient}`);
    if (!notification) return;

    // Keep potentially sensitive complaint information off a locked-device screen.
    const payload = JSON.stringify({
      title: "FixFlow complaint update",
      body: "There is a new update. Sign in to view the complaint.",
      path: notification.complaint
        ? `${complaintPaths[notification.recipientRef] || "/student/complaints"}/${notification.complaint}`
        : "/login",
    });

    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        payload,
        { TTL: 60, urgency: "high" },
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pushSubscriptionModel.deleteOne({ _id: subscription._id });
      } else {
        console.error("Could not deliver a web push notification:", error.message);
      }
    }
  }));
}

module.exports = { sendPushNotifications };
