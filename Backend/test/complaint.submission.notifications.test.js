const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const config = require("../src/config/config");

const studentModel = require("../src/models/student.model");
const adminModel = require("../src/models/admin.model");
const complaintModel = require("../src/models/complaint.model");
const slaService = require("../src/services/sla.service");
const notificationService = require("../src/services/notification.service");
const { fingerprintComplaint } = require("../src/services/complaintTriage.service");

const storagePath = require.resolve("../src/services/storage.service");
const storageModule = new Module(storagePath);
storageModule.filename = storagePath;
storageModule.loaded = true;
storageModule.exports = async () => ({ url: "https://images.example.test/complaint.jpg" });
require.cache[storagePath] = storageModule;

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test("new complaint submission creates a student confirmation and admin alerts", async () => {
  const originals = {
    studentFindById: studentModel.findById,
    adminFind: adminModel.find,
    complaintCreate: complaintModel.create,
    complaintCount: complaintModel.countDocuments,
    getSlaPolicy: slaService.getSlaPolicy,
    makeComplaintSlaDates: slaService.makeComplaintSlaDates,
    createNotifications: notificationService.createNotifications,
  };
  const user = { _id: "student-1", role: "student" };
  const admins = [{ _id: "admin-1" }, { _id: "admin-2" }];
  const complaint = { _id: "complaint-1", complaintTitle: "Water leak" };
  let savedComplaint;
  let notificationEntries;

  studentModel.findById = async () => user;
  adminModel.find = () => ({
    select() { return this; },
    lean: async () => admins,
  });
  complaintModel.create = async (document) => {
    savedComplaint = document;
    return { ...document, ...complaint };
  };
  complaintModel.countDocuments = async () => 0;
  slaService.getSlaPolicy = async () => ({});
  slaService.makeComplaintSlaDates = () => ({});
  notificationService.createNotifications = async (entries) => { notificationEntries = entries; };

  try {
    const { createComplaint } = require("../src/controllers/student.controller");
    const triageInput = {
      title: "Water leak",
      description: "Leak near the entrance",
      category: "Plumbing",
      building: "A block",
    };
    const triageToken = jwt.sign({
      purpose: "complaint-triage-preview",
      fingerprint: fingerprintComplaint(triageInput),
      aiTriage: {
        suggestedCategory: "Plumbing",
        priority: "P3",
        urgency: "Normal",
        confidence: 0.8,
        summary: "Water leak near the entrance",
        missingInformation: [],
        safetyConcern: false,
        rationale: "Staff should review the reported leak.",
        reviewSignal: "actionable",
        reviewSignalReason: "Enough details to review.",
        relatedOpenReports: 0,
      },
    }, config.JWT_SECRET, { subject: user._id });
    const response = makeResponse();
    await createComplaint({
      auth: { id: user._id, role: "student" },
      body: {
        title: "Water leak",
        description: "Leak near the entrance",
        category: "Plumbing",
        building: "A block",
        room: "12",
        triageToken,
      },
      file: { buffer: Buffer.from("image") },
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(savedComplaint.complaintTitle, "Water leak");
    assert.equal(notificationEntries.length, 3);
    assert.deepEqual(notificationEntries.map(({ recipientRef, type }) => [recipientRef, type]), [
      ["student", "submitted"],
      ["admin", "submitted"],
      ["admin", "submitted"],
    ]);
  } finally {
    studentModel.findById = originals.studentFindById;
    adminModel.find = originals.adminFind;
    complaintModel.create = originals.complaintCreate;
    complaintModel.countDocuments = originals.complaintCount;
    slaService.getSlaPolicy = originals.getSlaPolicy;
    slaService.makeComplaintSlaDates = originals.makeComplaintSlaDates;
    notificationService.createNotifications = originals.createNotifications;
  }
});
