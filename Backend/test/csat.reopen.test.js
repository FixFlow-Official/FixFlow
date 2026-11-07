const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const studentController = require("../src/controllers/student.controller");
const complaintModel = require("../src/models/complaint.model");

test("verifyComplaintResolution enforces role, ownership, and status constraints", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const otherStudentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  // 1. Rejects non-student
  {
    const req = { auth: { id: studentId, role: "staff" }, params: { complaintId }, body: { rating: 5 } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) { statusSent = s; return this; },
      json(j) { jsonSent = j; },
    };
    await studentController.verifyComplaintResolution(req, res);
    assert.equal(statusSent, 403);
    assert.match(jsonSent.message, /only students/i);
  }

  // Mock complaint
  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    status: "In_Progress",
    resolutionVerified: false,
    statusHistory: [],
    save: async () => {},
  };

  const originalFindById = complaintModel.findById;

  try {
    complaintModel.findById = async () => fakeComplaint;

    // 2. Rejects if not owner
    {
      const req = { auth: { id: otherStudentId, role: "student" }, params: { complaintId }, body: { rating: 5 } };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.verifyComplaintResolution(req, res);
      assert.equal(statusSent, 403);
      assert.match(jsonSent.message, /only the student who submitted/i);
    }

    // 3. Rejects if not resolved
    {
      const req = { auth: { id: studentId, role: "student" }, params: { complaintId }, body: { rating: 5 } };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.verifyComplaintResolution(req, res);
      assert.equal(statusSent, 400);
      assert.match(jsonSent.message, /currently marked as Resolved/i);
    }

    // 4. Rejects invalid rating
    fakeComplaint.status = "Resolved";
    {
      const req = { auth: { id: studentId, role: "student" }, params: { complaintId }, body: { rating: 6 } };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.verifyComplaintResolution(req, res);
      assert.equal(statusSent, 400);
      assert.match(jsonSent.message, /rating between 1 and 5/i);
    }

    // 5. Successful verification
    {
      const req = {
        auth: { id: studentId, role: "student", name: "Kohinoor" },
        params: { complaintId },
        body: { rating: 5, feedback: "Great repair work!" },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.verifyComplaintResolution(req, res);
      assert.equal(statusSent, 200);
      assert.equal(fakeComplaint.resolutionVerified, true);
      assert.equal(fakeComplaint.csatRating, 5);
      assert.equal(fakeComplaint.csatFeedback, "Great repair work!");
      assert.equal(fakeComplaint.statusHistory.length, 1);
    }
  } finally {
    complaintModel.findById = originalFindById;
  }
});

test("reopenComplaint transitions status to In_Progress and records reason", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    status: "Resolved",
    resolutionVerified: true,
    reopenedCount: 0,
    statusHistory: [],
    save: async () => {},
  };

  const originalFindById = complaintModel.findById;

  try {
    complaintModel.findById = async () => fakeComplaint;

    // 1. Rejects missing reason
    {
      const req = {
        auth: { id: studentId, role: "student" },
        params: { complaintId },
        body: { reason: "   " },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.reopenComplaint(req, res);
      assert.equal(statusSent, 400);
      assert.match(jsonSent.message, /please explain why/i);
    }

    // 2. Successful reopen
    {
      const req = {
        auth: { id: studentId, role: "student", name: "Kohinoor" },
        params: { complaintId },
        body: { reason: "The socket is sparking again when plugged in." },
      };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status(s) { statusSent = s; return this; },
        json(j) { jsonSent = j; },
      };
      await studentController.reopenComplaint(req, res);
      assert.equal(statusSent, 200);
      assert.equal(fakeComplaint.status, "In_Progress");
      assert.equal(fakeComplaint.resolutionVerified, false);
      assert.equal(fakeComplaint.reopenedCount, 1);
      assert.equal(fakeComplaint.reopenReason, "The socket is sparking again when plugged in.");
      assert.equal(fakeComplaint.statusHistory.length, 1);
      assert.equal(fakeComplaint.statusHistory[0].status, "In_Progress");
    }
  } finally {
    complaintModel.findById = originalFindById;
  }
});
