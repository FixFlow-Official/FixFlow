const assert = require("node:assert/strict");
const test = require("node:test");
const complaintModel = require("../src/models/complaint.model");

const storageModulePath = require.resolve("../src/services/storage.service");
const originalUploadFile = require(storageModulePath);
const uploadCalls = [];
let uploadResult = { url: "https://cdn.example.edu/resolution-proof.png" };

require.cache[storageModulePath].exports = async (buffer, fileName) => {
  uploadCalls.push({ buffer, fileName });
  return uploadResult;
};

const { updateComplaintStatus } = require("../src/controllers/staff.controller");

const complaintId = "507f1f77bcf86cd799439011";
const staffId = "507f191e810c19729de860ea";

function createComplaint() {
  return {
    status: "In_Progress",
    onHoldReason: null,
    statusHistory: [],
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
  };
}

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function withComplaint(complaint, callback) {
  const originalFindOne = complaintModel.findOne;
  complaintModel.findOne = async () => complaint;
  try {
    return await callback();
  } finally {
    complaintModel.findOne = originalFindOne;
  }
}

function staffRequest(file) {
  return {
    auth: { id: staffId, role: "staff" },
    params: { complaintId },
    body: { status: "Resolved", note: "Repaired and verified." },
    file,
  };
}

test("requires proof before resolving a complaint", async () => {
  const complaint = createComplaint();
  let findCalls = 0;
  const originalFindOne = complaintModel.findOne;
  complaintModel.findOne = async () => {
    findCalls += 1;
    return complaint;
  };

  try {
    const response = makeResponse();
    await updateComplaintStatus(staffRequest(undefined), response);

    assert.equal(response.statusCode, 400);
    assert.match(response.payload.message, /Attach a photo/);
    assert.equal(findCalls, 0);
    assert.equal(complaint.saveCalls, 0);
  } finally {
    complaintModel.findOne = originalFindOne;
  }
});

test("uploads resolution proof and saves it with resolution metadata", async () => {
  const complaint = createComplaint();
  const proofBuffer = Buffer.from("resolution proof image bytes");
  uploadCalls.length = 0;
  uploadResult = { url: "https://cdn.example.edu/resolution-proof.png" };

  await withComplaint(complaint, async () => {
    const response = makeResponse();
    await updateComplaintStatus(
      staffRequest({ buffer: proofBuffer }),
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(complaint.status, "Resolved");
    assert.equal(complaint.resolutionProofUrl, uploadResult.url);
    assert.equal(complaint.resolutionNote, "Repaired and verified.");
    assert.ok(complaint.resolvedAt instanceof Date);
    assert.equal(complaint.resolvedBy, staffId);
    assert.equal(complaint.statusHistory[0].status, "Resolved");
    assert.equal(complaint.saveCalls, 1);
  });

  assert.deepEqual(uploadCalls, [
    {
      buffer: proofBuffer,
      fileName: `resolution-${complaintId}`,
    },
  ]);
});

test("does not resolve or save when proof upload fails", async () => {
  const complaint = createComplaint();
  uploadCalls.length = 0;
  uploadResult = null;

  await withComplaint(complaint, async () => {
    const response = makeResponse();
    await updateComplaintStatus(
      staffRequest({ buffer: Buffer.from("resolution proof image bytes") }),
      response,
    );

    assert.equal(response.statusCode, 500);
    assert.equal(complaint.status, "In_Progress");
    assert.equal(complaint.saveCalls, 0);
  });

  require.cache[storageModulePath].exports = originalUploadFile;
});
