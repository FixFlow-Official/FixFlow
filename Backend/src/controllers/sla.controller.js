const complaintModel = require("../models/complaint.model");
const slaEventModel = require("../models/slaEvent.model");
const slaPolicyModel = require("../models/slaPolicy.model");
const {
  ACTIVE_STATUSES,
  SLA_CATEGORIES,
  ensureSlaPolicies,
  recalculateActiveComplaintDeadlines,
} = require("../services/sla.service");
const { getPageMetadata, getPageOptions } = require("../utils/complaintPagination");

const maxPolicies = new Set(SLA_CATEGORIES);

async function getSlaOverview(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can view SLA tracking." });
  }
  const pageOptions = getPageOptions(req.query);
  if (pageOptions.error) return res.status(400).json({ message: pageOptions.error });

  const view = req.query.view || "all";
  if (!["all", "response", "resolution"].includes(view)) {
    return res.status(400).json({ message: "Choose a valid overdue queue." });
  }
  const now = new Date();
  const activeFilter = { status: { $in: ACTIVE_STATUSES } };
  const responseOverdue = { ...activeFilter, slaResponseDueAt: { $lte: now }, slaFirstRespondedAt: null };
  const resolutionOverdue = { ...activeFilter, slaResolutionDueAt: { $lte: now } };
  const overdueFilter = view === "response"
    ? responseOverdue
    : view === "resolution"
      ? resolutionOverdue
      : { ...activeFilter, $or: [
          { slaResponseDueAt: { $lte: now }, slaFirstRespondedAt: null },
          { slaResolutionDueAt: { $lte: now } },
        ] };

  try {
    const [policies, complaints, total, responseOverdueCount, resolutionOverdueCount, recentEvents] = await Promise.all([
      ensureSlaPolicies(),
      complaintModel.find(overdueFilter)
        .populate("user", "username rollno")
        .populate("assignedStaff", "username staffId department")
        .sort({ slaResolutionDueAt: 1, slaResponseDueAt: 1, createdAt: 1 })
        .skip(pageOptions.skip)
        .limit(pageOptions.limit)
        .lean(),
      complaintModel.countDocuments(overdueFilter),
      complaintModel.countDocuments(responseOverdue),
      complaintModel.countDocuments(resolutionOverdue),
      slaEventModel.find({}).sort({ createdAt: -1 }).limit(40).lean(),
    ]);

    return res.status(200).json({
      now,
      policies,
      complaints,
      pagination: getPageMetadata(pageOptions.page, pageOptions.limit, total),
      counts: { responseOverdue: responseOverdueCount, resolutionOverdue: resolutionOverdueCount },
      recentEvents,
    });
  } catch (error) {
    console.error("getSlaOverview failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not load SLA tracking." });
  }
}

async function updateSlaPolicies(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can update SLA targets." });
  }
  const { policies } = req.body || {};
  if (!Array.isArray(policies) || policies.length !== SLA_CATEGORIES.length) {
    return res.status(400).json({ message: "Provide SLA targets for each complaint category." });
  }

  const seenCategories = new Set();
  const normalizedPolicies = [];
  for (const policy of policies) {
    const { category, responseHours, resolutionHours, reminderBeforeHours } = policy || {};
    if (!maxPolicies.has(category) || seenCategories.has(category)) {
      return res.status(400).json({ message: "Each valid complaint category must appear once." });
    }
    if (!Number.isInteger(responseHours) || responseHours < 1 || responseHours > 720
      || !Number.isInteger(resolutionHours) || resolutionHours < 1 || resolutionHours > 2160
      || !Number.isInteger(reminderBeforeHours) || reminderBeforeHours < 0 || reminderBeforeHours > 168
      || reminderBeforeHours > Math.min(responseHours, resolutionHours)) {
      return res.status(400).json({
        message: "Response (1–720h), resolution (1–2160h), and reminder (0–168h) targets must be valid; reminder cannot exceed either target.",
      });
    }
    seenCategories.add(category);
    normalizedPolicies.push({ category, responseHours, resolutionHours, reminderBeforeHours });
  }

  try {
    await slaPolicyModel.bulkWrite(normalizedPolicies.map((policy) => ({
      updateOne: {
        filter: { category: policy.category },
        update: { $set: { ...policy, updatedBy: req.auth.id } },
        upsert: true,
      },
    })), { ordered: true });
    await recalculateActiveComplaintDeadlines(normalizedPolicies);
    const savedPolicies = await slaPolicyModel.find({}).sort({ category: 1 }).lean();
    return res.status(200).json({ message: "SLA targets saved and applied to open complaints.", policies: savedPolicies });
  } catch (error) {
    console.error("updateSlaPolicies failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not save SLA targets." });
  }
}

async function getComplaintSlaHistory(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can view SLA history." });
  }
  const complaintId = req.params.complaintId;
  if (!/^[a-f\d]{24}$/i.test(complaintId)) {
    return res.status(400).json({ message: "Invalid complaint ID." });
  }
  try {
    const events = await slaEventModel.find({ complaint: complaintId }).sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json({ events });
  } catch (error) {
    console.error("getComplaintSlaHistory failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not load this complaint’s SLA history." });
  }
}

module.exports = { getSlaOverview, updateSlaPolicies, getComplaintSlaHistory };
