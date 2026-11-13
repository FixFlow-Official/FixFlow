const mongoose = require("mongoose");
const complaintModel = require("../models/complaint.model");
const slaPolicyModel = require("../models/slaPolicy.model");
const slaEventModel = require("../models/slaEvent.model");
const adminModel = require("../models/admin.model");
const studentModel = require("../models/student.model");
const { createNotifications, complaintNotification } = require("./notification.service");

const SLA_CATEGORIES = ["Electrical", "Plumbing", "Cleaning", "Internet", "Furniture", "Other"];
const DEFAULT_POLICIES = SLA_CATEGORIES.map((category) => ({
  category,
  responseHours: 24,
  resolutionHours: 120,
  reminderBeforeHours: 4,
}));
const ACTIVE_STATUSES = ["Submitted", "Under_Review", "Assigned", "In_Progress", "On_Hold", "Reopened"];
const SCAN_INTERVAL_MS = 5 * 60 * 1000;

async function ensureSlaPolicies() {
  const existingPolicies = await slaPolicyModel.find({}).select("category").lean();
  const existingCategories = new Set(existingPolicies.map((policy) => policy.category));
  const missingPolicies = DEFAULT_POLICIES.filter((policy) => !existingCategories.has(policy.category));
  if (missingPolicies.length) {
    await slaPolicyModel.bulkWrite(
      missingPolicies.map((policy) => ({
      updateOne: {
        filter: { category: policy.category },
        update: { $setOnInsert: policy },
        upsert: true,
      },
      })),
    );
  }
  return slaPolicyModel.find({}).sort({ category: 1 }).lean();
}

async function getSlaPolicy(category) {
  const storedPolicy = await slaPolicyModel.findOne({ category }).lean();
  return storedPolicy || DEFAULT_POLICIES.find((policy) => policy.category === category) || DEFAULT_POLICIES.at(-1);
}

function makeComplaintSlaDates(policy, submittedAt = new Date()) {
  const start = new Date(submittedAt);
  return {
    slaResponseDueAt: new Date(start.getTime() + policy.responseHours * 60 * 60 * 1000),
    slaResolutionDueAt: new Date(start.getTime() + policy.resolutionHours * 60 * 60 * 1000),
    slaFirstRespondedAt: null,
  };
}

async function backfillComplaintSlaDates() {
  const cursor = complaintModel.find({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { slaResponseDueAt: null },
      { slaResponseDueAt: { $exists: false } },
      { slaResolutionDueAt: null },
      { slaResolutionDueAt: { $exists: false } },
    ],
  }).select("_id category createdAt slaFirstRespondedAt statusHistory").lean().cursor();
  let operations = [];
  for await (const complaint of cursor) {
    const policy = await getSlaPolicy(complaint.category);
    const dates = makeComplaintSlaDates(policy, complaint.createdAt || new Date());
    const firstStaffResponse = (complaint.statusHistory || []).find((entry) =>
      entry.changedByRole === "staff"
      && ["Under_Review", "In_Progress", "On_Hold", "Resolved"].includes(entry.status));
    operations.push({
      updateOne: {
        filter: { _id: complaint._id },
        update: {
          $set: {
            ...(complaint.slaResponseDueAt ? {} : { slaResponseDueAt: dates.slaResponseDueAt }),
            ...(complaint.slaResolutionDueAt ? {} : { slaResolutionDueAt: dates.slaResolutionDueAt }),
            ...(complaint.slaFirstRespondedAt === undefined
              ? { slaFirstRespondedAt: firstStaffResponse?.changedAt || null }
              : {}),
          },
        },
      },
    });
    if (operations.length === 500) {
      await complaintModel.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }
  if (operations.length) await complaintModel.bulkWrite(operations, { ordered: false });
}

async function backfillComplaintUserSnapshots() {
  const cursor = complaintModel.find({
    userRef: "student",
    $or: [
      { userSnapshot: null },
      { "userSnapshot.name": null },
      { "userSnapshot.name": "" },
    ],
  }).select("_id user").lean().cursor();

  const studentCache = new Map();
  let operations = [];

  for await (const complaint of cursor) {
    if (!complaint.user) continue;
    const userId = String(complaint.user);
    let student = studentCache.get(userId);
    if (student === undefined) {
      student = await studentModel.findById(complaint.user).select("username rollno email role").lean();
      studentCache.set(userId, student);
    }

    if (student) {
      operations.push({
        updateOne: {
          filter: { _id: complaint._id },
          update: {
            $set: {
              userSnapshot: {
                name: student.username,
                campusId: String(student.rollno ?? ""),
                email: student.email,
                role: "student",
              },
            },
          },
        },
      });
    }

    if (operations.length === 500) {
      await complaintModel.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }

  if (operations.length) await complaintModel.bulkWrite(operations, { ordered: false });
}

async function recalculateActiveComplaintDeadlines(policies) {
  const byCategory = new Map(policies.map((policy) => [policy.category, policy]));
  const cursor = complaintModel.find({ status: { $in: ACTIVE_STATUSES } })
    .select("_id category createdAt slaFirstRespondedAt")
    .lean().cursor();
  let operations = [];
  for await (const complaint of cursor) {
    const policy = byCategory.get(complaint.category) || byCategory.get("Other");
    const dates = makeComplaintSlaDates(policy, complaint.createdAt || new Date());
    operations.push({
      updateOne: {
        filter: { _id: complaint._id },
        update: {
          $set: {
            slaResolutionDueAt: dates.slaResolutionDueAt,
            ...(complaint.slaFirstRespondedAt ? {} : { slaResponseDueAt: dates.slaResponseDueAt }),
          },
        },
      },
    });
    if (operations.length === 500) {
      await complaintModel.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }
  if (operations.length) await complaintModel.bulkWrite(operations, { ordered: false });
}

function getSlaEventsForComplaint(complaint, policy, now = new Date()) {
  if (!ACTIVE_STATUSES.includes(complaint.status)) return [];
  const rules = [
    {
      dueAt: complaint.slaResponseDueAt,
      complete: Boolean(complaint.slaFirstRespondedAt),
      reminderType: "response_reminder",
      overdueType: "response_overdue",
      subject: "first response",
    },
    {
      dueAt: complaint.slaResolutionDueAt,
      complete: false,
      reminderType: "resolution_reminder",
      overdueType: "resolution_overdue",
      subject: "resolution",
    },
  ];
  const reminderMs = policy.reminderBeforeHours * 60 * 60 * 1000;
  return rules.flatMap((rule) => {
    if (rule.complete || !rule.dueAt) return [];
    const dueAt = new Date(rule.dueAt);
    if (Number.isNaN(dueAt.getTime())) return [];
    const isOverdue = dueAt <= now;
    const isReminderWindow = !isOverdue && reminderMs > 0 && dueAt.getTime() - now.getTime() <= reminderMs;
    if (!isOverdue && !isReminderWindow) return [];
    const type = isOverdue ? rule.overdueType : rule.reminderType;
    const label = isOverdue ? "overdue" : "due soon";
    return [{
      type,
      dueAt,
      eventKey: `${complaint._id}:${type}:${dueAt.toISOString()}`,
      description: `The ${rule.subject} target is ${label} for “${complaint.complaintTitle}”.`,
      isEscalation: isOverdue,
    }];
  });
}

async function persistAndNotifySlaEvent(complaint, event, adminRecipients = []) {
  let inserted = false;
  try {
    const result = await slaEventModel.updateOne(
      { eventKey: event.eventKey },
      {
        $setOnInsert: {
          eventKey: event.eventKey,
          complaint: complaint._id,
          complaintTitle: complaint.complaintTitle || "Complaint",
          category: complaint.category || "Other",
          type: event.type,
          description: event.description,
          dueAt: event.dueAt,
        },
      },
      { upsert: true },
    );
    inserted = result.upsertedCount === 1 || Boolean(result.upsertedId);
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  if (!inserted) return false;

  const isEscalation = event.isEscalation;
  const recipients = [];
  if (complaint.assignedStaff) {
    recipients.push({ recipient: complaint.assignedStaff, recipientRef: "staff" });
  }
  // Admins receive breached SLAs and reminders for complaints that have not
  // been assigned to a staff member yet.
  if (isEscalation || !complaint.assignedStaff) {
    recipients.push(...adminRecipients);
  }
  const title = isEscalation ? "Complaint SLA overdue" : "Complaint SLA reminder";
  await createNotifications(recipients.map((recipient) => complaintNotification({
    ...recipient,
    complaint,
    type: isEscalation ? "sla_escalation" : "sla_reminder",
    title,
    message: event.description,
  })));
  return true;
}

async function processSlaDeadlines({ now = new Date() } = {}) {
  const policies = await ensureSlaPolicies();
  const maxReminderHours = Math.max(...policies.map((policy) => policy.reminderBeforeHours));
  const horizon = new Date(now.getTime() + maxReminderHours * 60 * 60 * 1000);
  const complaints = await complaintModel.find({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { slaResponseDueAt: { $lte: horizon }, slaFirstRespondedAt: null },
      { slaResolutionDueAt: { $lte: horizon } },
    ],
  }).select("_id complaintTitle category status assignedStaff slaResponseDueAt slaResolutionDueAt slaFirstRespondedAt")
    .lean();
  const policiesByCategory = new Map(policies.map((policy) => [policy.category, policy]));
  const adminAccounts = complaints.length
    ? await adminModel.find({}).select("_id").lean()
    : [];
  const adminRecipients = adminAccounts.map((admin) => ({ recipient: admin._id, recipientRef: "admin" }));
  let newEvents = 0;
  for (const complaint of complaints) {
    const policy = policiesByCategory.get(complaint.category) || policiesByCategory.get("Other");
    for (const event of getSlaEventsForComplaint(complaint, policy, now)) {
      if (await persistAndNotifySlaEvent(complaint, event, adminRecipients)) newEvents += 1;
    }
  }
  return { scanned: complaints.length, newEvents };
}

const LOCK_COLLECTION_NAME = "cluster_locks";
const SLA_LOCK_KEY = "sla_monitor_lock";
const DEFAULT_LOCK_TTL_MS = 4 * 60 * 1000;

let lockIndexPromise = null;

async function ensureLockIndexes(database) {
  if (!database) return null;

  if (!lockIndexPromise) {
    const collection = database.collection(LOCK_COLLECTION_NAME);
    lockIndexPromise = Promise.all([
      collection.createIndex(
        { lockKey: 1 },
        { unique: true, name: "cluster_lock_key" },
      ),
      collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "cluster_lock_ttl" },
      ),
    ]).catch((err) => {
      lockIndexPromise = null;
      throw err;
    });
  }

  await lockIndexPromise;
  return database.collection(LOCK_COLLECTION_NAME);
}

async function acquireClusterLock(lockKey = SLA_LOCK_KEY, ttlMs = DEFAULT_LOCK_TTL_MS) {
  try {
    const database = mongoose.connection.db;
    if (!database || mongoose.connection.readyState !== 1) {
      return null;
    }

    const collection = await ensureLockIndexes(database);
    if (!collection) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const workerId = `${process.pid}-${Math.random().toString(36).slice(2, 9)}`;

    const result = await collection.findOneAndUpdate(
      {
        lockKey,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false } },
        ],
      },
      {
        $set: {
          lockKey,
          acquiredAt: now,
          expiresAt,
          acquiredBy: workerId,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    const doc = result?.value || result;
    if (doc && doc.acquiredBy === workerId) {
      return { lockKey, workerId };
    }
    return null;
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }
    console.warn("Could not acquire cluster lock:", error.message);
    return null;
  }
}

async function releaseClusterLock(lock) {
  if (!lock?.lockKey || !lock?.workerId) return false;
  try {
    const database = mongoose.connection.db;
    if (!database || mongoose.connection.readyState !== 1) return false;

    const collection = database.collection(LOCK_COLLECTION_NAME);
    const result = await collection.deleteOne({
      lockKey: lock.lockKey,
      acquiredBy: lock.workerId,
    });
    return (result?.deletedCount || 0) > 0;
  } catch (error) {
    console.warn("Could not release cluster lock:", error.message);
    return false;
  }
}

function startSlaMonitor({
  intervalMs = SCAN_INTERVAL_MS,
  lockTtlMs = DEFAULT_LOCK_TTL_MS,
  acquireLock = acquireClusterLock,
  releaseLock = releaseClusterLock,
} = {}) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    let lock = null;
    try {
      lock = await acquireLock(SLA_LOCK_KEY, lockTtlMs);
      if (!lock) {
        return;
      }
      const result = await processSlaDeadlines();
      if (result.newEvents) console.info("Complaint SLA monitor recorded events", result);
    } catch (error) {
      console.error("Complaint SLA monitor failed:", error.message);
    } finally {
      if (lock) {
        await releaseLock(lock);
      }
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

const checkComplaintSlaTargets = processSlaDeadlines;

module.exports = {
  ACTIVE_STATUSES,
  DEFAULT_POLICIES,
  SLA_CATEGORIES,
  acquireClusterLock,
  backfillComplaintSlaDates,
  backfillComplaintUserSnapshots,
  checkComplaintSlaTargets,
  ensureSlaPolicies,
  getSlaEventsForComplaint,
  getSlaPolicy,
  makeComplaintSlaDates,
  processSlaDeadlines,
  recalculateActiveComplaintDeadlines,
  releaseClusterLock,
  startSlaMonitor,
};
