const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DEFAULT_POLICIES,
  acquireClusterLock,
  getSlaEventsForComplaint,
  makeComplaintSlaDates,
  releaseClusterLock,
} = require("../src/services/sla.service");
const mongoose = require("mongoose");

const policy = { responseHours: 24, resolutionHours: 120, reminderBeforeHours: 4 };
const complaintId = "507f1f77bcf86cd799439011";

test("snapshots response and resolution targets from the complaint submission time", () => {
  const submittedAt = new Date("2026-11-03T00:00:00.000Z");
  const deadlines = makeComplaintSlaDates(policy, submittedAt);

  assert.equal(deadlines.slaResponseDueAt.toISOString(), "2026-11-04T00:00:00.000Z");
  assert.equal(deadlines.slaResolutionDueAt.toISOString(), "2026-11-08T00:00:00.000Z");
  assert.equal(deadlines.slaFirstRespondedAt, null);
});

test("provides a default policy for every supported complaint category", () => {
  assert.deepEqual(DEFAULT_POLICIES.map((entry) => entry.category), [
    "Electrical", "Plumbing", "Cleaning", "Internet", "Furniture", "Other",
  ]);
  assert.ok(DEFAULT_POLICIES.every((entry) => entry.responseHours > 0 && entry.resolutionHours >= entry.responseHours));
});

test("creates one reminder for a target inside the configured reminder window", () => {
  const now = new Date("2026-11-03T00:00:00.000Z");
  const complaint = {
    _id: complaintId,
    status: "In_Progress",
    complaintTitle: "Water leak",
    slaResponseDueAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
    slaResolutionDueAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
  };

  const events = getSlaEventsForComplaint(complaint, policy, now);
  assert.deepEqual(events.map((event) => event.type), ["response_reminder"]);
  assert.equal(events[0].isEscalation, false);
  assert.match(events[0].description, /first response target is due soon/);
});

test("escalates breached response and resolution targets only once per SLA deadline", () => {
  const now = new Date("2026-11-03T12:00:00.000Z");
  const complaint = {
    _id: complaintId,
    status: "In_Progress",
    complaintTitle: "Water leak",
    slaResponseDueAt: new Date("2026-11-03T08:00:00.000Z"),
    slaResolutionDueAt: new Date("2026-11-03T10:00:00.000Z"),
  };
  const events = getSlaEventsForComplaint(complaint, policy, now);

  assert.deepEqual(events.map((event) => event.type), ["response_overdue", "resolution_overdue"]);
  assert.ok(events.every((event) => event.isEscalation));
  assert.ok(events.every((event) => event.eventKey.includes(complaintId)));
});

test("does not send response reminders after staff have acknowledged the complaint", () => {
  const now = new Date("2026-11-03T12:00:00.000Z");
  const complaint = {
    _id: complaintId,
    status: "In_Progress",
    complaintTitle: "Water leak",
    slaResponseDueAt: new Date("2026-11-03T08:00:00.000Z"),
    slaResolutionDueAt: new Date("2026-11-03T10:00:00.000Z"),
    slaFirstRespondedAt: new Date("2026-11-02T20:00:00.000Z"),
  };
  const events = getSlaEventsForComplaint(complaint, policy, now);

  assert.deepEqual(events.map((event) => event.type), ["resolution_overdue"]);
});

test("does not evaluate terminal complaints", () => {
  const events = getSlaEventsForComplaint({
    _id: complaintId,
    status: "Resolved",
    slaResponseDueAt: new Date("2026-11-03T08:00:00.000Z"),
    slaResolutionDueAt: new Date("2026-11-03T10:00:00.000Z"),
  }, policy, new Date("2026-11-03T12:00:00.000Z"));

  assert.deepEqual(events, []);
});

test("acquires distributed cluster lock and releases it cleanly", async () => {
  const originalDb = mongoose.connection.db;
  const originalReadyState = mongoose.connection.readyState;
  let storedLock = null;
  const mockCollection = {
    createIndex: async () => {},
    findOneAndUpdate: async (filter, update) => {
      if (storedLock && storedLock.expiresAt > new Date()) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      storedLock = { ...update.$set };
      return { value: storedLock };
    },
    deleteOne: async (filter) => {
      if (storedLock && storedLock.lockKey === filter.lockKey && storedLock.acquiredBy === filter.acquiredBy) {
        storedLock = null;
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },
  };

  Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });
  Object.defineProperty(mongoose.connection, "db", {
    value: { collection: () => mockCollection },
    configurable: true,
  });

  try {
    const lock1 = await acquireClusterLock("test_lock", 60_000);
    assert.ok(lock1);
    assert.equal(lock1.lockKey, "test_lock");
    assert.ok(lock1.workerId);

    // Second worker calling concurrently fails
    const lock2 = await acquireClusterLock("test_lock", 60_000);
    assert.equal(lock2, null);

    // Releasing first lock frees it up
    const released = await releaseClusterLock(lock1);
    assert.equal(released, true);

    // Now another worker can acquire it
    const lock3 = await acquireClusterLock("test_lock", 60_000);
    assert.ok(lock3);
    assert.equal(lock3.lockKey, "test_lock");
  } finally {
    Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
    Object.defineProperty(mongoose.connection, "db", { value: originalDb, configurable: true });
  }
});
