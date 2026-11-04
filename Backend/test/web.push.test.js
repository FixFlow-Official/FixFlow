const test = require("node:test");
const assert = require("node:assert/strict");

const { isAllowedEndpoint } = require("../src/controllers/pushSubscription.controller");
const { buildPushPayload } = require("../src/services/webPush.service");
const notificationModel = require("../src/models/notification.model");

test("accepts HTTPS push endpoints used by major browser push services", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/example",
    "https://updates.push.services.mozilla.com/wpush/v2/example",
    "https://web.push.apple.com/Q2xZ/example",
    "https://notify.windows.com/w/?token=example",
  ]) {
    assert.equal(isAllowedEndpoint(endpoint), true, endpoint);
  }
});

test("rejects unsafe or unsupported push endpoint URLs", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/example",
    "https://example.com/push",
    "https://fcm.googleapis.com.attacker.invalid/push",
    "https://user@fcm.googleapis.com/push",
    "https://fcm.googleapis.com:8443/push",
  ]) {
    assert.equal(isAllowedEndpoint(endpoint), false, endpoint);
  }
});

test("builds an event-specific staff SLA push with a complaint-specific replacement tag", () => {
  const payload = buildPushPayload({
    _id: "notification-1",
    complaint: "complaint-42",
    recipientRef: "staff",
    type: "sla_escalation",
    complaintTitle: "Water supply in block A",
    message: "The first response target is overdue for “Water supply in block A”.",
  });

  assert.deepEqual(payload, {
    title: "Complaint deadline overdue",
    body: "The first response target is overdue for “Water supply in block A”.",
    path: "/staff/complaints/complaint-42",
    tag: "fixflow-complaint-42-sla_escalation",
    notificationId: "notification-1",
  });
});

test("describes complaint assignment without exposing conversation text", () => {
  const payload = buildPushPayload({
    complaint: "complaint-43",
    recipientRef: "student",
    type: "assigned",
    complaintTitle: "Broken classroom projector",
    message: "Your complaint is assigned to Priya (Facilities).",
  });

  assert.equal(payload.title, "Complaint assigned");
  assert.equal(payload.body, "“Broken classroom projector” has been assigned to a staff member.");
  assert.equal(JSON.stringify(payload).includes("Priya"), false);
});

test("describes status updates using the new status, not the private note", () => {
  const payload = buildPushPayload({
    recipientRef: "student",
    type: "status",
    complaintTitle: "Water supply",
    message: "Your complaint is now In_Progress. Please call me at 555-0100.",
  });

  assert.equal(payload.title, "Complaint status changed");
  assert.equal(payload.body, "“Water supply” status: In Progress.");
  assert.equal(JSON.stringify(payload).includes("555-0100"), false);
});

test("uses a safe login target when a push has no complaint reference", () => {
  assert.equal(buildPushPayload({ recipientRef: "admin", type: "update" }).path, "/login");
});

test("allows complaint submission notifications in the notification model", () => {
  assert.ok(notificationModel.schema.path("type").enumValues.includes("submitted"));
});
