const complaintModel = require("../models/complaint.model");

const reportActiveStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
  "Reopened",
];

function roundTo1Decimal(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function msToHours(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  return roundTo1Decimal(ms / 3600000);
}

function formatPeriodRange(startDate, endDate) {
  const options = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  const startStr = new Intl.DateTimeFormat("en-US", options).format(startDate);
  const endStr = new Intl.DateTimeFormat("en-US", options).format(endDate);
  return `${startStr} – ${endStr}`;
}

/**
 * Shared executive aggregation pipeline.
 * Computes MTTR, first-response, SLA breach rates, technician efficiency, and CSAT breakdown.
 */
async function queryExecutiveMetrics({ period = "90d", now = new Date() } = {}) {
  const startDate = new Date(now);
  if (period === "7d") startDate.setDate(startDate.getDate() - 7);
  else if (period === "30d") startDate.setDate(startDate.getDate() - 30);
  else if (period === "90d") startDate.setDate(startDate.getDate() - 90);
  else if (period === "12m") {
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

  return {
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
  };
}

/**
 * Builds structured executive facility digest data for reports and PDF generation.
 */
async function buildExecutiveDigest({ period = "7d", now = new Date() } = {}) {
  const metrics = await queryExecutiveMetrics({ period, now });

  const startDate = new Date(now);
  if (period === "7d") startDate.setDate(startDate.getDate() - 7);
  else if (period === "30d") startDate.setDate(startDate.getDate() - 30);
  else if (period === "90d") startDate.setDate(startDate.getDate() - 90);
  else if (period === "12m") startDate.setMonth(startDate.getMonth() - 11);

  const periodLabel = period === "all"
    ? "All Time"
    : formatPeriodRange(startDate, now);

  // Top 5 departments by complaint volume
  const mttrByDepartment = [...(metrics.mttrByDepartment || [])]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top 5 SLA breach locations
  const slaBreachHeatmap = [...(metrics.slaBreachHeatmap || [])]
    .sort((a, b) => (b.breachRate ?? -1) - (a.breachRate ?? -1))
    .slice(0, 5);

  // Technician efficiency: top 5 + bottom 3
  const allTechs = [...(metrics.technicianEfficiency || [])];
  allTechs.sort((a, b) => {
    if (a.avgResolveHours !== null && b.avgResolveHours !== null) {
      return a.avgResolveHours - b.avgResolveHours;
    }
    if (a.avgResolveHours !== null) return -1;
    if (b.avgResolveHours !== null) return 1;
    return b.resolved - a.resolved;
  });

  const top5 = allTechs.slice(0, 5);
  const bottom3 = allTechs.length > 5 ? allTechs.slice(-3) : [];
  const techMap = new Map();
  for (const t of top5) {
    techMap.set(t.staffId, { ...t, digestGroup: "top" });
  }
  for (const t of bottom3) {
    if (!techMap.has(t.staffId)) {
      techMap.set(t.staffId, { ...t, digestGroup: "bottom" });
    }
  }
  const technicianEfficiency = Array.from(techMap.values());

  const csatByDepartment = metrics.csatByDepartment || [];

  return {
    generatedAt: now,
    periodLabel,
    summary: metrics.summary,
    mttrByDepartment,
    slaBreachHeatmap,
    technicianEfficiency,
    csatByDepartment,
  };
}

module.exports = {
  queryExecutiveMetrics,
  buildExecutiveDigest,
  roundTo1Decimal,
  msToHours,
  formatPeriodRange,
};
