const assert = require("node:assert/strict");
const test = require("node:test");
const complaintModel = require("../src/models/complaint.model");
const staffModel = require("../src/models/staff.model");
const {
  assignComplaint,
  reassignComplaint,
} = require("../src/controllers/admin.controller");

const complaintId = "507f1f77bcf86cd799439011";

function createComplaint({ status = "Submitted", assignedStaff = null } = {}) {
  return {
    status,
    assignedStaff,
    assignedDepartment: null,
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

function withModelStubs(stubs, callback) {
  const originals = [];

  for (const [model, method, implementation] of stubs) {
    originals.push([model, method, model[method]]);
    model[method] = implementation;
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [model, method, original] of originals) {
        model[method] = original;
      }
    });
}

function adminRequest() {
  return {
    auth: { id: "507f191e810c19729de860ea", role: "admin" },
    params: { complaintId },
    body: { staffId: "123", department: "Electrical" },
  };
}

test("assigns an unassigned complaint to staff in the chosen department", async () => {
  const complaint = createComplaint();
  const staff = {
    _id: "507f191e810c19729de860eb",
    username: "Amit Kumar",
    department: "Electrical",
  };

  await withModelStubs(
    [
      [complaintModel, "findOne", async () => complaint],
      [staffModel, "findOne", async () => staff],
    ],
    async () => {
      const response = makeResponse();
      await assignComplaint(adminRequest(), response);

      assert.equal(response.statusCode, 200);
      assert.equal(complaint.status, "Assigned");
      assert.equal(complaint.assignedStaff, staff._id);
      assert.equal(complaint.assignedDepartment, "Electrical");
      assert.match(complaint.statusHistory[0].note, /Amit Kumar/);
      assert.equal(complaint.saveCalls, 1);
    },
  );
});

test("reassigns an active complaint and records the previous and new staff", async () => {
  const previousStaffId = "507f1f77bcf86cd799439012";
  const nextStaff = {
    _id: "507f1f77bcf86cd799439013",
    username: "Sunita Devi",
    staffId: 456,
    department: "Housekeeping",
  };
  const complaint = createComplaint({
    status: "In_Progress",
    assignedStaff: previousStaffId,
  });
  complaint.assignedDepartment = "Electrical";

  await withModelStubs(
    [
      [complaintModel, "findOne", async () => complaint],
      [staffModel, "findOne", async () => nextStaff],
      [
        staffModel,
        "findById",
        () => ({
          select: async () => ({ username: "Amit Kumar", staffId: 123 }),
        }),
      ],
    ],
    async () => {
      const response = makeResponse();
      await reassignComplaint(adminRequest(), response);

      assert.equal(response.statusCode, 200);
      assert.equal(complaint.assignedStaff, nextStaff._id);
      assert.equal(complaint.assignedDepartment, "Housekeeping");
      assert.match(complaint.statusHistory[0].note, /Amit Kumar/);
      assert.match(complaint.statusHistory[0].note, /Sunita Devi/);
      assert.equal(complaint.statusHistory[0].status, "In_Progress");
      assert.equal(complaint.saveCalls, 1);
    },
  );
});

test("does not reassign a resolved complaint", async () => {
  const complaint = createComplaint({ status: "Resolved", assignedStaff: "507f1f77bcf86cd799439012" });
  let capturedQuery;

  await withModelStubs(
    [
      [
        complaintModel,
        "findOne",
        async (query) => {
          capturedQuery = query;
          return null;
        },
      ],
    ],
    async () => {
      const response = makeResponse();
      await reassignComplaint(adminRequest(), response);

      assert.equal(response.statusCode, 404);
      assert.deepEqual(capturedQuery.status.$nin, [
        "Resolved",
        "Rejected",
        "Closed",
        "Withdrawn",
      ]);
      assert.equal(complaint.saveCalls, 0);
    },
  );
});
