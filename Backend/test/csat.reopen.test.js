const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const studentController = require("../src/controllers/student.controller");
const adminController = require("../src/controllers/admin.controller");
const complaintModel = require("../src/models/complaint.model");
const adminModel = require("../src/models/admin.model");
const notificationModel = require("../src/models/notification.model");
const smsWhatsAppService = require("../src/services/smsWhatsApp.service");

// Stub async database-bound side-effects during unit tests
notificationModel.insertMany = async () => [];
smsWhatsAppService.dispatchTimelineAlerts = async () => {};

test("CSAT rating: 1-5 works, rating 6 returns 400, second rating returns 400, rating <= 2 sets adminAuditRequired=true", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    status: "Resolved",
    csatRating: null,
    csatFeedback: null,
    adminAuditRequired: false,
    resolutionVerified: false,
    statusHistory: [],
    ticketNumber: "T-100",
    complaintTitle: "Fan not working in Room 101",
    save: async () => {},
  };

  const originalFindById = complaintModel.findById;
  const originalAdminFind = adminModel.find;

  try {
    complaintModel.findById = async () => fakeComplaint;
    adminModel.find = () => ({
      select: () => ({
        lean: async () => [{ _id: new mongoose.Types.ObjectId(), email: "admin@fixflow.edu" }],
      }),
    });

    // 1. Rating 6 returns 400
    {
      const req = {
        auth: { id: studentId, role: "student" },
        params: { complaintId },
        body: { rating: 6 },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.submitCsat(req, res);
      assert.equal(statusSent, 400);
      assert.match(jsonSent.message, /rating between 1 and 5/i);
    }

    // 2. Rating <= 2 works and sets adminAuditRequired = true
    {
      const req = {
        auth: { id: studentId, role: "student", name: "Student A" },
        params: { complaintId },
        body: { rating: 2, feedback: "Still noisy and loose." },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.submitCsat(req, res);
      assert.equal(statusSent, 200);
      assert.equal(fakeComplaint.csatRating, 2);
      assert.equal(fakeComplaint.csatFeedback, "Still noisy and loose.");
      assert.equal(fakeComplaint.adminAuditRequired, true);
      assert.equal(fakeComplaint.resolutionVerified, true);
    }

    // 3. Second rating on the same resolution returns 400
    {
      const req = {
        auth: { id: studentId, role: "student", name: "Student A" },
        params: { complaintId },
        body: { rating: 5 },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.submitCsat(req, res);
      assert.equal(statusSent, 400);
      assert.match(jsonSent.message, /already been submitted/i);
    }
  } finally {
    complaintModel.findById = originalFindById;
    adminModel.find = originalAdminFind;
  }
});

test("CSAT rating & reopen: non-owner cannot rate or reopen (403)", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const otherStudentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    status: "Resolved",
    csatRating: null,
    resolvedAt: new Date(),
    save: async () => {},
  };

  const originalFindById = complaintModel.findById;

  try {
    complaintModel.findById = async () => fakeComplaint;

    // Non-owner rates -> 403
    {
      const req = {
        auth: { id: otherStudentId, role: "student" },
        params: { complaintId },
        body: { rating: 5 },
      };
      let statusSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json() {},
      };
      await studentController.submitCsat(req, res);
      assert.equal(statusSent, 403);
    }

    // Non-owner reopens -> 403
    {
      const req = {
        auth: { id: otherStudentId, role: "student" },
        params: { complaintId },
        body: { reason: "Still broken" },
      };
      let statusSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json() {},
      };
      await studentController.reopenComplaint(req, res);
      assert.equal(statusSent, 403);
    }
  } finally {
    complaintModel.findById = originalFindById;
  }
});

test("reopenComplaint within 48h transitions status to Reopened, increments count, and clears csatRating", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    status: "Resolved",
    resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    resolutionVerified: true,
    csatRating: 2,
    reopenedCount: 0,
    statusHistory: [],
    ticketNumber: "T-102",
    complaintTitle: "Water tap leakage",
    assignedStaff: new mongoose.Types.ObjectId(),
    save: async () => {},
  };

  const originalFindById = complaintModel.findById;
  const originalAdminFind = adminModel.find;

  try {
    complaintModel.findById = async () => fakeComplaint;
    adminModel.find = () => ({
      select: () => ({
        lean: async () => [{ _id: new mongoose.Types.ObjectId(), email: "depthead@fixflow.edu" }],
      }),
    });

    const req = {
      auth: { id: studentId, role: "student", name: "Kohinoor" },
      params: { complaintId },
      body: { reason: "The faucet is still leaking heavily from underneath." },
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) { statusSent = s; return this; },
      json(j) { jsonSent = j; },
    };

    await studentController.reopenComplaint(req, res);
    assert.equal(statusSent, 200);
    assert.equal(fakeComplaint.status, "Reopened");
    assert.equal(fakeComplaint.reopenedCount, 1);
    assert.equal(fakeComplaint.reopenReason, "The faucet is still leaking heavily from underneath.");
    assert.equal(fakeComplaint.csatRating, null);
    assert.equal(fakeComplaint.resolutionVerified, false);
    assert.equal(fakeComplaint.statusHistory.length, 1);
    assert.equal(fakeComplaint.statusHistory[0].status, "Reopened");
  } finally {
    complaintModel.findById = originalFindById;
    adminModel.find = originalAdminFind;
  }
});

test("reopenComplaint after 48h returns 400 window expired error", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    status: "Resolved",
    resolvedAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago (past 48h)
    resolutionVerified: true,
    reopenedCount: 0,
    statusHistory: [],
    save: async () => {},
  };

  const originalFindById = complaintModel.findById;

  try {
    complaintModel.findById = async () => fakeComplaint;

    const req = {
      auth: { id: studentId, role: "student", name: "Kohinoor" },
      params: { complaintId },
      body: { reason: "Still not working after 3 days." },
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) { statusSent = s; return this; },
      json(j) { jsonSent = j; },
    };

    await studentController.reopenComplaint(req, res);
    assert.equal(statusSent, 400);
    assert.match(jsonSent.message, /reopen window has expired/i);
    assert.equal(fakeComplaint.status, "Resolved");
    assert.equal(fakeComplaint.reopenedCount, 0);
  } finally {
    complaintModel.findById = originalFindById;
  }
});

test("admin audit queue and resolve audit endpoint", async () => {
  const complaintId = new mongoose.Types.ObjectId();
  const fakeComplaint = {
    _id: complaintId,
    adminAuditRequired: true,
    status: "Resolved",
    statusHistory: [],
    save: async () => {},
  };

  const originalFind = complaintModel.find;
  const originalFindById = complaintModel.findById;

  try {
    complaintModel.find = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            sort: () => ({
              lean: async () => [fakeComplaint],
            }),
          }),
        }),
      }),
    });
    complaintModel.findById = async () => fakeComplaint;

    // 1. GET /api/admin/audit-queue
    {
      const req = { auth: { role: "admin" } };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await adminController.getAuditQueue(req, res);
      assert.equal(statusSent, 200);
      assert.equal(jsonSent.complaints.length, 1);
      assert.equal(jsonSent.complaints[0].adminAuditRequired, true);
    }

    // 2. PATCH /api/admin/complaints/:id/audit
    {
      const req = {
        auth: { id: new mongoose.Types.ObjectId(), role: "admin", name: "Admin Officer" },
        params: { complaintId },
        body: { note: "Technician re-visited and confirmed repair is complete." },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await adminController.resolveComplaintAudit(req, res);
      assert.equal(statusSent, 200);
      assert.equal(fakeComplaint.adminAuditRequired, false);
      assert.equal(fakeComplaint.statusHistory.length, 1);
      assert.match(fakeComplaint.statusHistory[0].note, /Admin audit resolved/);
    }
  } finally {
    complaintModel.find = originalFind;
    complaintModel.findById = originalFindById;
  }
});
