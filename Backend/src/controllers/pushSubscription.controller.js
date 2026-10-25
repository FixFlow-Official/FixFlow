const pushSubscriptionModel = require("../models/pushSubscription.model");
const config = require("../config/config");

const allowedPushHosts = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

function isAllowedEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedPushHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function isPushConfigured() {
  return Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
}

function getPushConfig(req, res) {
  return res.status(200).json({
    enabled: isPushConfigured(),
    publicKey: isPushConfigured() ? config.VAPID_PUBLIC_KEY : null,
  });
}

async function savePushSubscription(req, res) {
  if (!isPushConfigured()) {
    return res.status(503).json({ message: "Push notifications are not configured on this server yet." });
  }

  const { endpoint, keys } = req.body || {};
  if (
    typeof endpoint !== "string" || endpoint.length > 2048 || !isAllowedEndpoint(endpoint) ||
    typeof keys?.p256dh !== "string" || keys.p256dh.length > 256 ||
    typeof keys?.auth !== "string" || keys.auth.length > 256
  ) {
    return res.status(400).json({ message: "Invalid push subscription." });
  }

  try {
    await pushSubscriptionModel.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          recipient: req.auth.id,
          recipientRef: req.auth.role,
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: String(req.get("user-agent") || "").slice(0, 500),
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(201).json({ message: "Push notifications enabled for this device." });
  } catch (error) {
    console.error("savePushSubscription failed:", error);
    return res.status(500).json({ message: "Could not save this device's push subscription." });
  }
}

async function removePushSubscription(req, res) {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !isAllowedEndpoint(endpoint)) {
    return res.status(400).json({ message: "Invalid push subscription endpoint." });
  }

  try {
    await pushSubscriptionModel.deleteOne({
      endpoint,
      recipient: req.auth.id,
      recipientRef: req.auth.role,
    });
    return res.status(200).json({ message: "Push notifications disabled for this device." });
  } catch (error) {
    console.error("removePushSubscription failed:", error);
    return res.status(500).json({ message: "Could not disable push notifications." });
  }
}

module.exports = { getPushConfig, savePushSubscription, removePushSubscription };
