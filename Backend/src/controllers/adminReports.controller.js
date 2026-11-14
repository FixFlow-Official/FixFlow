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

function roundTo1Decimal(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function msToHours(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  return roundTo1Decimal(ms / 3600000);
}

// Executive facility health, MTTR and SLA analytics
async function getExecutiveReports(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can view executive reports." });
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

  const periodStart = period === "all" ? null : startDate;
  const match = { userRef: "student" };
  if (periodStart) match.createdAt = { $gte: periodStart, $lte: now };

  const breachCondition = {
    $and: [
      { $ne: [{ $ifNull: ["$slaResolutionDueAt", null] }, null] },
      {
        $or: [
          {
            $and: [
              { $ne: [{ $ifNull: ["$resolvedAt", null] }, null] },
              { $gt: ["$resolvedAt", "$slaResolutionDueAt"] },
            ],
          },
          {
            $and: [
              { $in: ["$status", reportActiveStatuses] },
              { $lt: ["$slaResolutionDueAt", now] },
            ],
          },
        ],
      },
    ],
  };

  try {
    const [report] = await complaintModel.aggregate([
      { $match: match },
      {
        $addFields: {
          isResolved: { $eq: ["$status", "Resolved"] },
          resolvedDurationMs: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "Resolved"] },
                  { $ne: [{ $ifNull: ["$resolvedAt", null] }, null] },
                  { $gte: ["$resolvedAt", "$createdAt"] },
                ],
              },
              { $subtract: ["$resolvedAt", "$createdAt"] },
              null,
            ],
          },
          firstResponseDurationMs: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $ifNull: ["$slaFirstRespondedAt", null] }, null] },
                  { $gte: ["$slaFirstRespondedAt", "$createdAt"] },
                ],
              },
              { $subtract: ["$slaFirstRespondedAt", "$createdAt"] },
              null,
            ],
          },
          isBreached: { $cond: [breachCondition, 1, 0] },
          dept: {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ["$assignedDepartment", ""] }, ""] },
                  { $eq: ["$assignedDepartment", null] },
                ],
              },
              "Unassigned",
              "$assignedDepartment",
            ],
          },
          bldg: { $ifNull: ["$location.building", "Unknown"] },
          techStaffId: { $ifNull: ["$resolvedBy", "$assignedStaff"] },
          techName: {
            $ifNull: [
              "$resolvedBySnapshot.name",
              { $ifNull: ["$assignedStaffSnapshot.name", null] },
            ],
          },
          techDept: {
            $ifNull: [
              "$resolvedBySnapshot.department",
              { $ifNull: ["$assignedStaffSnapshot.department", null] },
            ],
          },
        },
      },
      {
        $facet: {
          mttrByDepartment: [
            {
              $group: {
                _id: "$dept",
                total: { $sum: 1 },
                resolved: { $sum: { $cond: ["$isResolved", 1, 0] } },
                totalResolutionMs: {
                  $sum: { $ifNull: ["$resolvedDurationMs", 0] },
                },
                resolvedDurationCount: {
                  $sum: { $cond: [{ $ne: ["$resolvedDurationMs", null] }, 1, 0] },
                },
                totalFirstResponseMs: {
                  $sum: { $ifNull: ["$firstResponseDurationMs", 0] },
                },
                firstResponseCount: {
                  $sum: { $cond: [{ $ne: ["$firstResponseDurationMs", null] }, 1, 0] },
                },
                slaBreachCount: { $sum: "$isBreached" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          slaBreachHeatmap: [
            {
              $group: {
                _id: { building: "$bldg", department: "$dept" },
                breachCount: { $sum: "$isBreached" },
                total: { $sum: 1 },
              },
            },
          ],
          technicianEfficiency: [
            {
              $match: {
                techStaffId: { $ne: null },
              },
            },
            {
              $group: {
                _id: "$techStaffId",
                name: { $first: "$techName" },
                department: { $first: "$techDept" },
                assigned: { $sum: 1 },
                resolved: { $sum: { $cond: ["$isResolved", 1, 0] } },
                totalAcknowledgeMs: {
                  $sum: { $ifNull: ["$firstResponseDurationMs", 0] },
                },
                acknowledgeCount: {
                  $sum: { $cond: [{ $ne: ["$firstResponseDurationMs", null] }, 1, 0] },
                },
                totalResolveMs: {
                  $sum: { $ifNull: ["$resolvedDurationMs", 0] },
                },
                resolveCount: {
                  $sum: { $cond: [{ $ne: ["$resolvedDurationMs", null] }, 1, 0] },
                },
                totalCsat: {
                  $sum: { $cond: [{ $ne: ["$csatRating", null] }, "$csatRating", 0] },
                },
                csatCount: {
                  $sum: { $cond: [{ $ne: ["$csatRating", null] }, 1, 0] },
                },
              },
            },
            {
              $lookup: {
                from: "staffs",
                localField: "_id",
                foreignField: "_id",
                as: "staffDoc",
              },
            },
          ],
          csatByDepartment: [
            {
              $group: {
                _id: "$dept",
                totalCsat: {
                  $sum: { $cond: [{ $ne: ["$csatRating", null] }, "$csatRating", 0] },
                },
                ratingsCount: {
                  $sum: { $cond: [{ $ne: ["$csatRating", null] }, 1, 0] },
                },
                lowRatingCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$csatRating", null] },
                          { $lte: ["$csatRating", 2] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                resolved: { $sum: { $cond: ["$isResolved", 1, 0] } },
                totalResolutionMs: {
                  $sum: { $ifNull: ["$resolvedDurationMs", 0] },
                },
                resolvedDurationCount: {
                  $sum: { $cond: [{ $ne: ["$resolvedDurationMs", null] }, 1, 0] },
                },
                totalFirstResponseMs: {
                  $sum: { $ifNull: ["$firstResponseDurationMs", 0] },
                },
                firstResponseCount: {
                  $sum: { $cond: [{ $ne: ["$firstResponseDurationMs", null] }, 1, 0] },
                },
                slaBreachCount: { $sum: "$isBreached" },
                totalCsat: {
                  $sum: { $cond: [{ $ne: ["$csatRating", null] }, "$csatRating", 0] },
                },
                csatCount: {
                  $sum: { $cond: [{ $ne: ["$csatRating", null] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]);

    const mttrByDepartment = (report?.mttrByDepartment || []).map((row) => {
      const avgResolutionHours = row.resolvedDurationCount > 0
        ? msToHours(row.totalResolutionMs / row.resolvedDurationCount)
        : null;
      const avgFirstResponseHours = row.firstResponseCount > 0
        ? msToHours(row.totalFirstResponseMs / row.firstResponseCount)
        : null;
      const slaBreachRate = row.total > 0
        ? roundTo1Decimal((row.slaBreachCount / row.total) * 100)
        : null;

      return {
        department: row._id,
        total: row.total,
        resolved: row.resolved,
        avgResolutionHours,
        avgFirstResponseHours,
        slaBreachCount: row.slaBreachCount,
        slaBreachRate,
      };
    });

    const slaBreachHeatmap = (report?.slaBreachHeatmap || [])
      .map((row) => {
        const breachRate = row.total > 0
          ? roundTo1Decimal((row.breachCount / row.total) * 100)
          : null;
        return {
          building: row._id.building,
          department: row._id.department,
          breachCount: row.breachCount,
          total: row.total,
          breachRate,
        };
      })
      .sort((a, b) => {
        const rateA = a.breachRate ?? -1;
        const rateB = b.breachRate ?? -1;
        if (rateB !== rateA) return rateB - rateA;
        return b.breachCount - a.breachCount;
      })
      .slice(0, 20);

    const technicianEfficiency = (report?.technicianEfficiency || []).map((row) => {
      const staffDoc = row.staffDoc?.[0];
      const name = staffDoc?.username || row.name || "Technician";
      const department = staffDoc?.department || row.department || "General";
      const staffId = staffDoc?.staffId ? String(staffDoc.staffId) : String(row._id);

      const avgAcknowledgeHours = row.acknowledgeCount > 0
        ? msToHours(row.totalAcknowledgeMs / row.acknowledgeCount)
        : null;
      const avgResolveHours = row.resolveCount > 0
        ? msToHours(row.totalResolveMs / row.resolveCount)
        : null;
      const avgCsat = row.csatCount > 0
        ? roundTo1Decimal(row.totalCsat / row.csatCount)
        : null;

      return {
        staffId,
        name,
        department,
        assigned: row.assigned,
        resolved: row.resolved,
        avgAcknowledgeHours,
        avgResolveHours,
        avgCsat,
      };
    });

    const csatByDepartment = (report?.csatByDepartment || []).map((row) => {
      const avgCsat = row.ratingsCount > 0
        ? roundTo1Decimal(row.totalCsat / row.ratingsCount)
        : null;
      return {
        department: row._id,
        avgCsat,
        ratingsCount: row.ratingsCount,
        lowRatingCount: row.lowRatingCount,
      };
    });

    const rawSummary = report?.summary?.[0] || {};
    const total = rawSummary.total || 0;
    const resolved = rawSummary.resolved || 0;
    const avgResolutionHours = rawSummary.resolvedDurationCount > 0
      ? msToHours(rawSummary.totalResolutionMs / rawSummary.resolvedDurationCount)
      : null;
    const avgFirstResponseHours = rawSummary.firstResponseCount > 0
      ? msToHours(rawSummary.totalFirstResponseMs / rawSummary.firstResponseCount)
      : null;
    const overallSlaBreachRate = total > 0
      ? roundTo1Decimal((rawSummary.slaBreachCount / total) * 100)
      : null;
    const avgCsat = rawSummary.csatCount > 0
      ? roundTo1Decimal(rawSummary.totalCsat / rawSummary.csatCount)
      : null;

    return res.status(200).json({
      period,
      generatedAt: now,
      summary: {
        total,
        resolved,
        avgResolutionHours,
        avgFirstResponseHours,
        overallSlaBreachRate,
        avgCsat,
      },
      mttrByDepartment,
      slaBreachHeatmap,
      technicianEfficiency,
      csatByDepartment,
    });
  } catch (error) {
    console.error("getExecutiveReports failed", { requestId: req.requestId, error });
    return res.status(500).json({ message: "Could not load executive reports." });
  }
}

module.exports = { getComplaintReports, getExecutiveReports };
