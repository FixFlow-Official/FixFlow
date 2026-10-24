const assert = require("node:assert/strict");
const test = require("node:test");
const complaintModel = require("../src/models/complaint.model");
const { updateComplaintStatus } = require("../src/controllers/staff.controller");

const complaintId = "507f1f77bcf86cd799439011";

function createComplaint(status) {
  return {
    status,
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

async function callUpdate(complaint, status) {
  const originalFindOne = complaintModel.findOne;
  complaintModel.findOne = async () => complaint;

  try {
    const response = makeResponse();
    await updateComplaintStatus(
      {
        auth: { id: "507f191e810c19729de860ea", role: "staff" },
        params: { complaintId },
        body: { status },
      },
      response,
    );
    return response;
  } finally {
    complaintModel.findOne = originalFindOne;
  }
}

test("allows a valid Assigned to In_Progress transition", async () => {
  const complaint = createComplaint("Assigned");
  const response = await callUpdate(complaint, "In_Progress");

  assert.equal(response.statusCode, 200);
  assert.equal(complaint.status, "In_Progress");
  assert.equal(complaint.statusHistory.length, 1);
  assert.equal(complaint.saveCalls, 1);
});

test("rejects status changes on every terminal complaint status", async () => {
  for (const status of ["Resolved", "Rejected", "Closed", "Withdrawn"]) {
    const complaint = createComplaint(status);
    const response = await callUpdate(complaint, "In_Progress");

    assert.equal(response.statusCode, 409, `${status} must be terminal`);
    assert.match(response.payload.message, /already closed/);
    assert.equal(complaint.saveCalls, 0);
  }
});

test("rejects backwards transitions from In_Progress to Under_Review", async () => {
  const complaint = createComplaint("In_Progress");
  const response = await callUpdate(complaint, "Under_Review");

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /Cannot change complaint status/);
  assert.equal(complaint.saveCalls, 0);
});
