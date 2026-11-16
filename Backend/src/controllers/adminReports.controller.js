const complaintModel = require("../models/complaint.model");

const reportActiveStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
  "Reopened",
];

// Aggregate complaint workflow metrics for the admin reports page.
async function getComplaintReports(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can view complaint reports." });
  }

  const period = req.query.period || "90d";
  if (!["30d", "90d", "12m", "all"].includes(period)) {
    return res.status(400).json({ message: "Choose a valid report period." });
  }

  const now = new Date();
  const startDate = new Date(now);
  if (period === "30d") startDate.setDate(startDate.getDate() - 30);
  if (period === "90d") startDate.setDate(startDate.getDate() - 90);
  if (period === "12m") {
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  }

  const trendStart = new Date(now);
  trendStart.setMonth(trendStart.getMonth() - 11);
  trendStart.setDate(1);
  trendStart.setHours(0, 0, 0, 0);

  const periodStart = period === "all" ? null : startDate;
  const dateFormat = period === "30d" ? "%Y-%m-%d" : "%Y-%m";
  const match = { userRef: "student" };
  if (periodStart) match.createdAt = { $gte: periodStart, $lte: now };

  try {
    const [report] = await complaintModel.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                current: { $sum: { $cond: [{ $in: ["$status", reportActiveStatuses] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
                unassigned: {
                  $sum: {
                    $cond: [
                      { $and: [{ $in: ["$status", ["Submitted", "Under_Review"]] }, { $eq: [{ $ifNull: ["$assignedStaff", null] }, null] }] },
                      1,
                      0,
                    ],
                  },
                },
                averageResolutionMs: {
                  $avg: {
                    $cond: [
                      { $and: [{ $eq: ["$status", "Resolved"] }, { $ne: [{ $ifNull: ["$resolvedAt", null] }, null] }] },
                      { $subtract: ["$resolvedAt", "$createdAt"] },
                      null,
                    ],
                  },
                },
              },
            },
          ],
          statuses: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          categories: [
            { $group: { _id: { $ifNull: ["$category", "Other"] }, count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          departments: [
            {
              $group: {
                _id: { $cond: [{ $eq: [{ $ifNull: ["$assignedDepartment", ""] }, ""] }, "Unassigned", "$assignedDepartment"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
          ],
          trend: [
            { $match: { createdAt: { $gte: period === "all" ? trendStart : (periodStart || trendStart), $lte: now } } },
            {
              $group: {
                _id: { $dateToString: { format: dateFormat, date: "$createdAt", timezone: "UTC" } },
                submitted: { $sum: 1 },
                resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const summary = report?.summary?.[0] || {};
    return res.status(200).json({
      period,
      generatedAt: now,
      summary: {
        total: summary.total || 0,
        current: summary.current || 0,
        resolved: summary.resolved || 0,
        unassigned: summary.unassigned || 0,
        averageResolutionHours: Number.isFinite(summary.averageResolutionMs)
          ? Math.round((summary.averageResolutionMs / 3600000) * 10) / 10
          : null,
      },
      statuses: report?.statuses || [],
      categories: report?.categories || [],
      departments: report?.departments || [],
      trend: report?.trend || [],
    });
  } catch (error) {
    console.error("getComplaintReports failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not load complaint reports." });
  }
}

const { queryExecutiveMetrics } = require("../services/executiveDigest.service");
const { sendWeeklyDigest } = require("../../scripts/sendWeeklyDigest");

// Executive facility health, MTTR and SLA analytics
async function getExecutiveReports(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can view executive reports." });
  }

  const period = req.query.period || "90d";
  if (!["7d", "30d", "90d", "12m", "all"].includes(period)) {
    return res.status(400).json({ message: "Choose a valid report period." });
  }

  try {
    const data = await queryExecutiveMetrics({ period });
    return res.status(200).json(data);
  } catch (error) {
    console.error("getExecutiveReports failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not load executive reports." });
  }
}

// Manual trigger for weekly executive facility digest
async function sendDigestNow(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can trigger the weekly digest." });
  }

  try {
    const period = req.body?.period || "7d";
    const result = await sendWeeklyDigest({ period });
    return res.status(200).json({
      message: "Weekly executive facility digest dispatched.",
      sentTo: result.sentTo,
      generatedAt: result.generatedAt,
      summary: result.summary,
    });
  } catch (error) {
    console.error("sendDigestNow failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not send weekly digest." });
  }
}

module.exports = { getComplaintReports, getExecutiveReports, sendDigestNow };
