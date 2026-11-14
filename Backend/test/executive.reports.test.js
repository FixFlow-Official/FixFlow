const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const complaintModel = require("../src/models/complaint.model");
const adminReportsController = require("../src/controllers/adminReports.controller");

function createMockRes() {
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };
  return res;
}

test("Executive reports: non-admin gets 403", async () => {
  const res = createMockRes();
  const req = {
    auth: { id: new mongoose.Types.ObjectId(), role: "student" },
    query: { period: "90d" },
  };

  await adminReportsController.getExecutiveReports(req, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /Only administrators/);
});

test("Executive reports: invalid period gets 400", async () => {
  const res = createMockRes();
  const req = {
    auth: { id: new mongoose.Types.ObjectId(), role: "admin" },
    query: { period: "invalid_period" },
  };

  await adminReportsController.getExecutiveReports(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /valid report period/);
});

test("Executive reports: empty dataset returns null for averages and empty arrays", async () => {
  const originalAggregate = complaintModel.aggregate;
  complaintModel.aggregate = async () => [{
    mttrByDepartment: [],
    slaBreachHeatmap: [],
    technicianEfficiency: [],
    csatByDepartment: [],
    summary: [],
  }];

  try {
    const res = createMockRes();
    const req = {
      auth: { id: new mongoose.Types.ObjectId(), role: "admin" },
      query: { period: "90d" },
    };

    await adminReportsController.getExecutiveReports(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.summary.total, 0);
    assert.equal(res.payload.summary.resolved, 0);
    assert.equal(res.payload.summary.avgResolutionHours, null);
    assert.equal(res.payload.summary.avgFirstResponseHours, null);
    assert.equal(res.payload.summary.overallSlaBreachRate, null);
    assert.equal(res.payload.summary.avgCsat, null);
    assert.deepEqual(res.payload.mttrByDepartment, []);
    assert.deepEqual(res.payload.slaBreachHeatmap, []);
    assert.deepEqual(res.payload.technicianEfficiency, []);
    assert.deepEqual(res.payload.csatByDepartment, []);
  } finally {
    complaintModel.aggregate = originalAggregate;
  }
});

test("Executive reports: MTTR maths, SLA breach logic, and technician grouping", async () => {
  const originalAggregate = complaintModel.aggregate;

  const staff1Id = new mongoose.Types.ObjectId();
  const staff2Id = new mongoose.Types.ObjectId();

  // Controlled test complaints
  const seededComplaints = [
    // 1. Electrical, North Hostel, Resolved, No breach (resolved in 10h, due in 24h), CSAT 5
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Electrical",
      location: { building: "North Hostel" },
      status: "Resolved",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      slaFirstRespondedAt: new Date("2026-11-01T12:00:00.000Z"), // 2.0h
      slaResolutionDueAt: new Date("2026-11-02T10:00:00.000Z"), // 24h
      resolvedAt: new Date("2026-11-01T20:00:00.000Z"), // 10.0h
      assignedStaff: staff1Id,
      resolvedBy: staff1Id,
      assignedStaffSnapshot: { name: "Alice Tech", department: "Electrical" },
      resolvedBySnapshot: { name: "Alice Tech", department: "Electrical" },
      csatRating: 5,
    },
    // 2. Electrical, North Hostel, Resolved, Breached (resolved in 48h, due in 24h), CSAT 3
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Electrical",
      location: { building: "North Hostel" },
      status: "Resolved",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      slaFirstRespondedAt: new Date("2026-11-01T14:00:00.000Z"), // 4.0h
      slaResolutionDueAt: new Date("2026-11-02T10:00:00.000Z"), // 24h
      resolvedAt: new Date("2026-11-03T10:00:00.000Z"), // 48.0h
      assignedStaff: staff1Id,
      resolvedBy: staff1Id,
      assignedStaffSnapshot: { name: "Alice Tech", department: "Electrical" },
      resolvedBySnapshot: { name: "Alice Tech", department: "Electrical" },
      csatRating: 3,
    },
    // 3. Plumbing, Science Block, In_Progress (active), Breached (due in the past), CSAT null
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Plumbing",
      location: { building: "Science Block" },
      status: "In_Progress",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      slaFirstRespondedAt: new Date("2026-11-01T16:00:00.000Z"), // 6.0h
      slaResolutionDueAt: new Date("2026-11-01T12:00:00.000Z"), // Due in past -> Breached
      resolvedAt: null,
      assignedStaff: staff2Id,
      resolvedBy: null,
      assignedStaffSnapshot: { name: "Bob Plumber", department: "Plumbing" },
      resolvedBySnapshot: null,
      csatRating: null,
    },
    // 4. Plumbing, Science Block, Submitted (active), NOT breached (due in future), CSAT 2 (low rating)
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Plumbing",
      location: { building: "Science Block" },
      status: "Submitted",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      slaFirstRespondedAt: null,
      slaResolutionDueAt: new Date("2026-12-01T10:00:00.000Z"), // Due in future -> Not breached
      resolvedAt: null,
      assignedStaff: staff2Id,
      resolvedBy: null,
      assignedStaffSnapshot: { name: "Bob Plumber", department: "Plumbing" },
      resolvedBySnapshot: null,
      csatRating: 2,
    },
  ];

  // In-memory pipeline emulator for testing math & contracts
  complaintModel.aggregate = async (pipeline) => {
    const activeStatuses = [
      "Submitted",
      "Under_Review",
      "Assigned",
      "In_Progress",
      "On_Hold",
      "Reopened",
    ];
    const now = new Date();

    const enriched = seededComplaints.map((c) => {
      const isResolved = c.status === "Resolved";
      const resolvedDurationMs = isResolved && c.resolvedAt ? (c.resolvedAt.getTime() - c.createdAt.getTime()) : null;
      const firstResponseDurationMs = c.slaFirstRespondedAt ? (c.slaFirstRespondedAt.getTime() - c.createdAt.getTime()) : null;

      let isBreached = 0;
      if (c.slaResolutionDueAt) {
        if (c.resolvedAt && c.resolvedAt > c.slaResolutionDueAt) {
          isBreached = 1;
        } else if (activeStatuses.includes(c.status) && c.slaResolutionDueAt < now) {
          isBreached = 1;
        }
      }

      return {
        ...c,
        isResolved,
        resolvedDurationMs,
        firstResponseDurationMs,
        isBreached,
        dept: c.assignedDepartment || "Unassigned",
        bldg: c.location?.building || "Unknown",
        techStaffId: c.resolvedBy || c.assignedStaff || null,
        techName: c.resolvedBySnapshot?.name || c.assignedStaffSnapshot?.name || "Technician",
        techDept: c.resolvedBySnapshot?.department || c.assignedStaffSnapshot?.department || "General",
      };
    });

    // Group mttrByDepartment
    const deptMap = {};
    for (const doc of enriched) {
      if (!deptMap[doc.dept]) {
        deptMap[doc.dept] = {
          _id: doc.dept,
          total: 0,
          resolved: 0,
          totalResolutionMs: 0,
          resolvedDurationCount: 0,
          totalFirstResponseMs: 0,
          firstResponseCount: 0,
          slaBreachCount: 0,
        };
      }
      const g = deptMap[doc.dept];
      g.total += 1;
      if (doc.isResolved) g.resolved += 1;
      if (doc.resolvedDurationMs !== null) {
        g.totalResolutionMs += doc.resolvedDurationMs;
        g.resolvedDurationCount += 1;
      }
      if (doc.firstResponseDurationMs !== null) {
        g.totalFirstResponseMs += doc.firstResponseDurationMs;
        g.firstResponseCount += 1;
      }
      g.slaBreachCount += doc.isBreached;
    }

    // Group slaBreachHeatmap
    const heatMap = {};
    for (const doc of enriched) {
      const key = `${doc.bldg}_${doc.dept}`;
      if (!heatMap[key]) {
        heatMap[key] = {
          _id: { building: doc.bldg, department: doc.dept },
          breachCount: 0,
          total: 0,
        };
      }
      heatMap[key].total += 1;
      heatMap[key].breachCount += doc.isBreached;
    }

    // Group technicianEfficiency
    const techMap = {};
    for (const doc of enriched) {
      if (!doc.techStaffId) continue;
      const key = String(doc.techStaffId);
      if (!techMap[key]) {
        techMap[key] = {
          _id: doc.techStaffId,
          name: doc.techName,
          department: doc.techDept,
          assigned: 0,
          resolved: 0,
          totalAcknowledgeMs: 0,
          acknowledgeCount: 0,
          totalResolveMs: 0,
          resolveCount: 0,
          totalCsat: 0,
          csatCount: 0,
          staffDoc: [{ username: doc.techName, department: doc.techDept }],
        };
      }
      const t = techMap[key];
      t.assigned += 1;
      if (doc.isResolved) t.resolved += 1;
      if (doc.firstResponseDurationMs !== null) {
        t.totalAcknowledgeMs += doc.firstResponseDurationMs;
        t.acknowledgeCount += 1;
      }
      if (doc.resolvedDurationMs !== null) {
        t.totalResolveMs += doc.resolvedDurationMs;
        t.resolveCount += 1;
      }
      if (doc.csatRating !== null && doc.csatRating !== undefined) {
        t.totalCsat += doc.csatRating;
        t.csatCount += 1;
      }
    }

    // Group csatByDepartment
    const csatDeptMap = {};
    for (const doc of enriched) {
      if (!csatDeptMap[doc.dept]) {
        csatDeptMap[doc.dept] = {
          _id: doc.dept,
          totalCsat: 0,
          ratingsCount: 0,
          lowRatingCount: 0,
        };
      }
      const c = csatDeptMap[doc.dept];
      if (doc.csatRating !== null && doc.csatRating !== undefined) {
        c.totalCsat += doc.csatRating;
        c.ratingsCount += 1;
        if (doc.csatRating <= 2) c.lowRatingCount += 1;
      }
    }

    // Summary
    const summary = {
      _id: null,
      total: enriched.length,
      resolved: enriched.filter((e) => e.isResolved).length,
      totalResolutionMs: enriched.reduce((sum, e) => sum + (e.resolvedDurationMs || 0), 0),
      resolvedDurationCount: enriched.filter((e) => e.resolvedDurationMs !== null).length,
      totalFirstResponseMs: enriched.reduce((sum, e) => sum + (e.firstResponseDurationMs || 0), 0),
      firstResponseCount: enriched.filter((e) => e.firstResponseDurationMs !== null).length,
      slaBreachCount: enriched.reduce((sum, e) => sum + e.isBreached, 0),
      totalCsat: enriched.reduce((sum, e) => sum + (e.csatRating || 0), 0),
      csatCount: enriched.filter((e) => e.csatRating !== null && e.csatRating !== undefined).length,
    };

    return [{
      mttrByDepartment: Object.values(deptMap),
      slaBreachHeatmap: Object.values(heatMap),
      technicianEfficiency: Object.values(techMap),
      csatByDepartment: Object.values(csatDeptMap),
      summary: [summary],
    }];
  };

  try {
    const res = createMockRes();
    const req = {
      auth: { id: new mongoose.Types.ObjectId(), role: "admin" },
      query: { period: "90d" },
    };

    await adminReportsController.getExecutiveReports(req, res);

    assert.equal(res.statusCode, 200);
    const data = res.payload;

    // 1. Check summary
    assert.equal(data.summary.total, 4);
    assert.equal(data.summary.resolved, 2);
    // avgResolutionHours: (10 + 48) / 2 = 29.0
    assert.equal(data.summary.avgResolutionHours, 29.0);
    // avgFirstResponseHours: (2 + 4 + 6) / 3 = 4.0
    assert.equal(data.summary.avgFirstResponseHours, 4.0);
    // overallSlaBreachRate: 2 breaches / 4 total = 50.0%
    assert.equal(data.summary.overallSlaBreachRate, 50.0);
    // avgCsat: (5 + 3 + 2) / 3 = 3.3
    assert.equal(data.summary.avgCsat, 3.3);

    // 2. Check MTTR by department
    const elect = data.mttrByDepartment.find((d) => d.department === "Electrical");
    assert.ok(elect, "Electrical department should exist in MTTR");
    assert.equal(elect.total, 2);
    assert.equal(elect.resolved, 2);
    assert.equal(elect.avgResolutionHours, 29.0);
    assert.equal(elect.avgFirstResponseHours, 3.0); // (2 + 4) / 2 = 3.0
    assert.equal(elect.slaBreachCount, 1);
    assert.equal(elect.slaBreachRate, 50.0);

    const plumb = data.mttrByDepartment.find((d) => d.department === "Plumbing");
    assert.ok(plumb, "Plumbing department should exist in MTTR");
    assert.equal(plumb.total, 2);
    assert.equal(plumb.resolved, 0);
    assert.equal(plumb.avgResolutionHours, null); // 0 resolved -> null
    assert.equal(plumb.avgFirstResponseHours, 6.0); // 6.0
    assert.equal(plumb.slaBreachCount, 1);
    assert.equal(plumb.slaBreachRate, 50.0);

    // 3. Check SLA breach heatmap
    assert.equal(data.slaBreachHeatmap.length, 2);
    for (const cell of data.slaBreachHeatmap) {
      assert.ok(cell.building);
      assert.ok(cell.department);
      assert.equal(cell.breachRate, 50.0);
    }

    // 4. Check technician efficiency
    const techAlice = data.technicianEfficiency.find((t) => t.name === "Alice Tech");
    assert.ok(techAlice, "Alice Tech should be present");
    assert.equal(techAlice.assigned, 2);
    assert.equal(techAlice.resolved, 2);
    assert.equal(techAlice.avgAcknowledgeHours, 3.0);
    assert.equal(techAlice.avgResolveHours, 29.0);
    assert.equal(techAlice.avgCsat, 4.0); // (5 + 3) / 2 = 4.0

    const techBob = data.technicianEfficiency.find((t) => t.name === "Bob Plumber");
    assert.ok(techBob, "Bob Plumber should be present");
    assert.equal(techBob.assigned, 2);
    assert.equal(techBob.resolved, 0);
    assert.equal(techBob.avgAcknowledgeHours, 6.0);
    assert.equal(techBob.avgResolveHours, null); // 0 resolved -> null
    assert.equal(techBob.avgCsat, 2.0); // (2) / 1 = 2.0

    // 5. Check CSAT by department
    const csatPlumb = data.csatByDepartment.find((c) => c.department === "Plumbing");
    assert.ok(csatPlumb);
    assert.equal(csatPlumb.ratingsCount, 1);
    assert.equal(csatPlumb.lowRatingCount, 1); // rating 2 is <= 2
    assert.equal(csatPlumb.avgCsat, 2.0);
  } finally {
    complaintModel.aggregate = originalAggregate;
  }
});
