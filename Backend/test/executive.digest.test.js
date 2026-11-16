const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const complaintModel = require("../src/models/complaint.model");
const adminModel = require("../src/models/admin.model");
const sendEmail = require("../src/services/email.service");
const { buildExecutiveDigest } = require("../src/services/executiveDigest.service");
const { generateExecutiveDigestPdf } = require("../src/services/executiveDigestPdf.service");
const { sendWeeklyDigest } = require("../scripts/sendWeeklyDigest");
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

test("Executive digest: builds from seeded data with correct MTTR and metrics", async () => {
  const originalAggregate = complaintModel.aggregate;

  const staffId = new mongoose.Types.ObjectId();
  const seededComplaints = [
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Electrical",
      location: { building: "Science Tower" },
      status: "Resolved",
      createdAt: new Date("2026-11-08T10:00:00.000Z"),
      slaFirstRespondedAt: new Date("2026-11-08T12:00:00.000Z"), // 2.0h
      slaResolutionDueAt: new Date("2026-11-09T10:00:00.000Z"),
      resolvedAt: new Date("2026-11-08T20:00:00.000Z"), // 10.0h
      assignedStaff: staffId,
      resolvedBy: staffId,
      assignedStaffSnapshot: { name: "John Spark", department: "Electrical" },
      resolvedBySnapshot: { name: "John Spark", department: "Electrical" },
      csatRating: 5,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Electrical",
      location: { building: "Science Tower" },
      status: "Resolved",
      createdAt: new Date("2026-11-08T10:00:00.000Z"),
      slaFirstRespondedAt: new Date("2026-11-08T14:00:00.000Z"), // 4.0h
      slaResolutionDueAt: new Date("2026-11-09T10:00:00.000Z"),
      resolvedAt: new Date("2026-11-10T10:00:00.000Z"), // 48.0h (Breached)
      assignedStaff: staffId,
      resolvedBy: staffId,
      assignedStaffSnapshot: { name: "John Spark", department: "Electrical" },
      resolvedBySnapshot: { name: "John Spark", department: "Electrical" },
      csatRating: 4,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userRef: "student",
      assignedDepartment: "Plumbing",
      location: { building: "East Hostel" },
      status: "In_Progress",
      createdAt: new Date("2026-11-08T10:00:00.000Z"),
      slaFirstRespondedAt: new Date("2026-11-08T16:00:00.000Z"),
      slaResolutionDueAt: new Date("2026-11-08T12:00:00.000Z"), // Past due -> Breached
      resolvedAt: null,
      assignedStaff: new mongoose.Types.ObjectId(),
      resolvedBy: null,
      assignedStaffSnapshot: { name: "Dave Pipe", department: "Plumbing" },
      resolvedBySnapshot: null,
      csatRating: null,
    },
  ];

  complaintModel.aggregate = async () => {
    return [{
      mttrByDepartment: [
        {
          _id: "Electrical",
          total: 2,
          resolved: 2,
          totalResolutionMs: (10 + 48) * 3600000,
          resolvedDurationCount: 2,
          totalFirstResponseMs: (2 + 4) * 3600000,
          firstResponseCount: 2,
          slaBreachCount: 1,
        },
        {
          _id: "Plumbing",
          total: 1,
          resolved: 0,
          totalResolutionMs: 0,
          resolvedDurationCount: 0,
          totalFirstResponseMs: 6 * 3600000,
          firstResponseCount: 1,
          slaBreachCount: 1,
        },
      ],
      slaBreachHeatmap: [
        { _id: { building: "Science Tower", department: "Electrical" }, breachCount: 1, total: 2 },
        { _id: { building: "East Hostel", department: "Plumbing" }, breachCount: 1, total: 1 },
      ],
      technicianEfficiency: [
        {
          _id: staffId,
          name: "John Spark",
          department: "Electrical",
          assigned: 2,
          resolved: 2,
          totalAcknowledgeMs: 6 * 3600000,
          acknowledgeCount: 2,
          totalResolveMs: 58 * 3600000,
          resolveCount: 2,
          totalCsat: 9,
          csatCount: 2,
          staffDoc: [{ username: "John Spark", department: "Electrical" }],
        },
      ],
      csatByDepartment: [
        { _id: "Electrical", totalCsat: 9, ratingsCount: 2, lowRatingCount: 0 },
      ],
      summary: [
        {
          _id: null,
          total: 3,
          resolved: 2,
          totalResolutionMs: 58 * 3600000,
          resolvedDurationCount: 2,
          totalFirstResponseMs: 12 * 3600000,
          firstResponseCount: 3,
          slaBreachCount: 2,
          totalCsat: 9,
          csatCount: 2,
        },
      ],
    }];
  };

  try {
    const digest = await buildExecutiveDigest({ period: "7d" });

    assert.ok(digest.generatedAt);
    assert.ok(digest.periodLabel);
    assert.equal(digest.summary.total, 3);
    assert.equal(digest.summary.resolved, 2);
    // MTTR: (10 + 48) / 2 = 29.0h
    assert.equal(digest.summary.avgResolutionHours, 29.0);
    // Breach rate: 2 / 3 = 66.7%
    assert.equal(digest.summary.overallSlaBreachRate, 66.7);
    // CSAT: 9 / 2 = 4.5
    assert.equal(digest.summary.avgCsat, 4.5);

    // mttrByDepartment top 5
    assert.equal(digest.mttrByDepartment.length, 2);
    assert.equal(digest.mttrByDepartment[0].department, "Electrical");
    assert.equal(digest.mttrByDepartment[0].avgResolutionHours, 29.0);

    // slaBreachHeatmap top 5
    assert.equal(digest.slaBreachHeatmap.length, 2);

    // technicianEfficiency top 5 + bottom 3
    assert.equal(digest.technicianEfficiency.length, 1);
    assert.equal(digest.technicianEfficiency[0].name, "John Spark");
    assert.equal(digest.technicianEfficiency[0].avgResolveHours, 29.0);
  } finally {
    complaintModel.aggregate = originalAggregate;
  }
});

test("Executive digest: PDF buffer is non-empty and starts with %PDF", async () => {
  const mockDigest = {
    periodLabel: "Nov 7 – Nov 14, 2026",
    generatedAt: new Date("2026-11-14T09:00:00.000Z"),
    summary: {
      total: 24,
      resolved: 19,
      avgResolutionHours: 14.2,
      avgFirstResponseHours: 1.8,
      overallSlaBreachRate: 8.3,
      avgCsat: 4.6,
    },
    mttrByDepartment: [
      { department: "Electrical", total: 12, resolved: 10, avgResolutionHours: 12.5, avgFirstResponseHours: 1.5, slaBreachRate: 8.3 },
      { department: "Plumbing", total: 8, resolved: 6, avgResolutionHours: 16.0, avgFirstResponseHours: 2.1, slaBreachRate: 12.5 },
    ],
    slaBreachHeatmap: [
      { building: "Central Library", department: "Electrical", breachCount: 1, total: 6, breachRate: 16.7 },
      { building: "Science Block", department: "Plumbing", breachCount: 1, total: 4, breachRate: 25.0 },
    ],
    technicianEfficiency: [
      { name: "Alice Tech", department: "Electrical", assigned: 10, resolved: 9, avgAcknowledgeHours: 1.5, avgResolveHours: 11.8, avgCsat: 4.8 },
      { name: "Bob Wrench", department: "Plumbing", assigned: 8, resolved: 6, avgAcknowledgeHours: 2.1, avgResolveHours: 16.0, avgCsat: 4.2 },
    ],
    csatByDepartment: [
      { department: "Electrical", avgCsat: 4.8, ratingsCount: 9, lowRatingCount: 0 },
      { department: "Plumbing", avgCsat: 4.2, ratingsCount: 6, lowRatingCount: 1 },
    ],
  };

  const pdfBuffer = await generateExecutiveDigestPdf(mockDigest);

  assert.ok(Buffer.isBuffer(pdfBuffer), "PDF output must be a Buffer");
  assert.ok(pdfBuffer.length > 1000, `PDF buffer length should be substantial, got ${pdfBuffer.length} bytes`);
  assert.equal(pdfBuffer.slice(0, 4).toString(), "%PDF", "PDF must begin with magic bytes %PDF");
});

test("Executive digest: invalid recipient email is skipped not fatal", async () => {
  const originalAggregate = complaintModel.aggregate;
  const originalAdminFind = adminModel.find;
  const originalTransporter = sendEmail.transporter;
  const originalEnvRecipients = process.env.DIGEST_RECIPIENTS;

  complaintModel.aggregate = async () => [{
    mttrByDepartment: [],
    slaBreachHeatmap: [],
    technicianEfficiency: [],
    csatByDepartment: [],
    summary: [{ _id: null, total: 0, resolved: 0, slaBreachCount: 0 }],
  }];

  // Admins contain 1 valid email and invalid/empty strings
  adminModel.find = () => ({
    select: () => ({
      lean: async () => [
        { email: "admin.chief@fixflow.edu" },
        { email: "not-an-email" },
        { email: "" },
        { email: null },
      ],
    }),
  });

  // DIGEST_RECIPIENTS contains 1 valid email and malformed string
  process.env.DIGEST_RECIPIENTS = "vp.facilities@fixflow.edu, invalid-email-format, , ";

  const sentEmails = [];
  sendEmail.transporter = {
    sendMail: async (mailOptions) => {
      sentEmails.push(mailOptions);
      return { messageId: "mock_msg_123" };
    },
  };

  try {
    const result = await sendWeeklyDigest({ period: "7d" });

    assert.equal(result.success, true);
    // Only the 2 valid emails should receive the digest
    assert.deepEqual(result.sentTo.sort(), [
      "admin.chief@fixflow.edu",
      "vp.facilities@fixflow.edu",
    ].sort());
    assert.equal(sentEmails.length, 2);

    for (const email of sentEmails) {
      assert.match(email.subject, /FixFlow Weekly Facility Digest/);
      assert.ok(email.text.includes("Full PDF attached."));
      assert.ok(email.attachments && email.attachments.length === 1);
      assert.match(email.attachments[0].filename, /\.pdf$/);
      assert.equal(email.attachments[0].content.slice(0, 4).toString(), "%PDF");
    }
  } finally {
    complaintModel.aggregate = originalAggregate;
    adminModel.find = originalAdminFind;
    sendEmail.transporter = originalTransporter;
    process.env.DIGEST_RECIPIENTS = originalEnvRecipients;
  }
});

test("Executive digest: send-now with mocked email service does not send a real email", async () => {
  const originalAggregate = complaintModel.aggregate;
  const originalAdminFind = adminModel.find;
  const originalTransporter = sendEmail.transporter;

  complaintModel.aggregate = async () => [{
    mttrByDepartment: [],
    slaBreachHeatmap: [],
    technicianEfficiency: [],
    csatByDepartment: [],
    summary: [{ _id: null, total: 5, resolved: 4, slaBreachCount: 0 }],
  }];

  adminModel.find = () => ({
    select: () => ({
      lean: async () => [{ email: "director@campus.edu" }],
    }),
  });

  let mailDispatched = null;
  sendEmail.transporter = {
    sendMail: async (mailOptions) => {
      mailDispatched = mailOptions;
      return { messageId: "mock_test_id" };
    },
  };

  try {
    // 1. Non-admin gets 403
    {
      const req = {
        auth: { role: "student" },
        body: { period: "7d" },
      };
      const res = createMockRes();
      await adminReportsController.sendDigestNow(req, res);
      assert.equal(res.statusCode, 403);
      assert.match(res.payload.message, /Only administrators/);
    }

    // 2. Admin gets 200 and mocked email receives PDF
    {
      const req = {
        auth: { role: "admin" },
        body: { period: "7d" },
      };
      const res = createMockRes();
      await adminReportsController.sendDigestNow(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.message, "Weekly executive facility digest dispatched.");
      assert.deepEqual(res.payload.sentTo, ["director@campus.edu"]);
      assert.ok(mailDispatched, "Mocked email service must be called");
      assert.equal(mailDispatched.to, "director@campus.edu");
      assert.match(mailDispatched.subject, /FixFlow Weekly Facility Digest/);
      assert.equal(mailDispatched.attachments[0].contentType, "application/pdf");
      assert.equal(mailDispatched.attachments[0].content.slice(0, 4).toString(), "%PDF");
    }
  } finally {
    complaintModel.aggregate = originalAggregate;
    adminModel.find = originalAdminFind;
    sendEmail.transporter = originalTransporter;
  }
});
