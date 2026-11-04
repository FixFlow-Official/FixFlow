const webPush = require("web-push");
const config = require("../config/config");
const pushSubscriptionModel = require("../models/pushSubscription.model");

const complaintPaths = {
  student: "/student/complaints",
  staff: "/staff/complaints",
  admin: "/admin/complaints",
};

function buildPushPayload(notification) {
  const complaintId = notification.complaint ? String(notification.complaint) : "";
  const recipientRole = notification.recipientRef || "student";
  const complaintTitle = String(notification.complaintTitle || "Complaint")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Complaint";
  const subject = `“${complaintTitle}”`;
  const pushCopy = {
    submitted: recipientRole === "admin"
      ? { title: "New complaint submitted", body: `${subject} is waiting for review.` }
      : { title: "Complaint submitted", body: `${subject} was submitted and is waiting for review.` },
    assigned: recipientRole === "staff"
      ? { title: "Complaint assigned to you", body: `${subject} is now in your complaint queue.` }
      : { title: "Complaint assigned", body: `${subject} has been assigned to a staff member.` },
    reassigned: recipientRole === "staff"
      ? { title: "Complaint reassigned", body: `${subject} was moved to another staff member.` }
      : { title: "Complaint reassigned", body: `${subject} was assigned to a different staff member.` },
    status: {
      title: "Complaint status changed",
      body: `${subject} status: ${(String(notification.message || "").match(/\bis now ([^.]+)/i)?.[1] || "updated").replaceAll("_", " ")}.`,
    },
    message: { title: "New complaint message", body: `A new message was added to ${subject}. Open FixFlow to read it.` },
    sla_reminder: {
      title: "Complaint deadline approaching",
      body: String(notification.message || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 150) || `${subject} needs attention soon.`,
    },
    sla_escalation: {
      title: "Complaint deadline overdue",
      body: String(notification.message || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 150) || `${subject} needs immediate attention.`,
    },
  };
  const notificationType = String(notification.type || "update")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 32);
  const copy = pushCopy[notification.type] || {
    title: String(notification.title || "FixFlow update").slice(0, 80),
    body: `${subject} has an update. Open FixFlow to review it.`,
  };
  return {
    title: copy.title.slice(0, 80),
    // Never include conversation text or arbitrary user notes in a lock-screen alert.
    body: copy.body.replace(/\s+/g, " ").trim().slice(0, 180),
    path: complaintId
      ? `${complaintPaths[notification.recipientRef] || "/student/complaints"}/${encodeURIComponent(complaintId)}`
      : "/login",
    // Same complaint and event type can update in place; unrelated complaints remain visible.
    tag: complaintId ? `fixflow-${complaintId}-${notificationType}` : `fixflow-${notificationType}`,
    notificationId: String(notification._id || ""),
  };
}

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
  if (notifications.length === 0) return;
  if (!configureVapid()) {
    console.warn("Web Push skipped: VAPID keys are not configured on the backend.");
    return;
  }

  const recipients = notifications.map(({ recipient, recipientRef }) => ({ recipient, recipientRef }));
  const subscriptions = await pushSubscriptionModel.find({ $or: recipients }).lean();
  if (subscriptions.length === 0) {
    console.info("Web Push skipped: no device subscriptions match these notification recipients.");
    return;
  }

  const deliveries = subscriptions.flatMap((subscription) => {
    const recipientNotifications = notifications.filter((item) =>
      String(item.recipientRef) === String(subscription.recipientRef) &&
      String(item.recipient) === String(subscription.recipient),
    );
    return recipientNotifications.map((notification) => ({ subscription, notification }));
  });

  // Deliver each event. A stable tag collapses repeated updates for one complaint,
  // while distinct complaints remain separately visible on the device.
  let acceptedByPushService = 0;
  let failedDeliveries = 0;
  await Promise.allSettled(deliveries.map(async ({ subscription, notification }) => {
    const payload = JSON.stringify(buildPushPayload(notification));

    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        payload,
        // Keep short outages recoverable without retaining stale complaint alerts for weeks.
        { TTL: 24 * 60 * 60, urgency: "high" },
      );
      acceptedByPushService += 1;
    } catch (error) {
      failedDeliveries += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        try {
          await pushSubscriptionModel.deleteOne({ _id: subscription._id });
        } catch (cleanupError) {
          console.error("Could not remove an expired push subscription:", cleanupError.message);
        }
      } else {
        console.error("Could not deliver a web push notification:", error.message);
      }
    }
  }));

  console.info(
    `Web Push delivery finished: ${acceptedByPushService} accepted by push services, ${failedDeliveries} failed.`,
  );
}

module.exports = { buildPushPayload, sendPushNotifications };
