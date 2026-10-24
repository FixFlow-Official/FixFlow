const assert = require("node:assert/strict");
const test = require("node:test");
const complaintModel = require("../src/models/complaint.model");
const jwt = require("jsonwebtoken");
const config = require("../src/config/config");
const { getAssignedComplaints: getAdminAssigned } = require("../src/controllers/admin.controller");
const { getAssignedComplaints: getStaffAssigned } = require("../src/controllers/staff.controller");
const { getComplaint: getStudentComplaints } = require("../src/controllers/student.controller");

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

function makeFindQuery(documents) {
  const captured = { skip: null, limit: null, sort: null };
  const query = {
    populate() { return this; },
    sort(value) { captured.sort = value; return this; },
    skip(value) { captured.skip = value; return this; },
    limit(value) { captured.limit = value; return Promise.resolve(documents); },
  };
  return { query, captured };
}

async function withComplaintStubs({ documents = [], total = 0 }, callback) {
  const originals = {
    find: complaintModel.find,
    countDocuments: complaintModel.countDocuments,
  };
  let capturedFilter;
  let capturedQuery;
  complaintModel.find = (filter) => {
    capturedFilter = filter;
    const result = makeFindQuery(documents);
    capturedQuery = result.captured;
    return result.query;
  };
  complaintModel.countDocuments = async () => total;

  try {
    return await callback(() => ({ capturedFilter, capturedQuery }));
  } finally {
    complaintModel.find = originals.find;
    complaintModel.countDocuments = originals.countDocuments;
  }
}

test("admin assigned endpoint applies server-side filters, ordering, and page boundaries", async () => {
  await withComplaintStubs({ documents: [{ _id: "complaint-1" }], total: 13 }, async (getCaptured) => {
    const response = makeResponse();
    await getAdminAssigned(
      {
        auth: { role: "admin" },
        query: { view: "current", page: "2", limit: "6", sort: "created", order: "asc" },
      },
      response,
    );

    const { capturedFilter, capturedQuery } = getCaptured();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(capturedFilter.status.$in, ["Assigned", "Under_Review", "In_Progress", "On_Hold"]);
    assert.equal(capturedQuery.skip, 6);
    assert.equal(capturedQuery.limit, 6);
    assert.deepEqual(capturedQuery.sort, { createdAt: 1 });
    assert.equal(response.payload.pagination.total, 13);
    assert.equal(response.payload.pagination.totalPages, 3);
  });
});

test("staff assigned endpoint applies requested status and returns page metadata", async () => {
  await withComplaintStubs({ documents: [{ _id: "complaint-2" }], total: 9 }, async (getCaptured) => {
    const response = makeResponse();
    await getStaffAssigned(
      {
        auth: { id: "507f191e810c19729de860ea", role: "staff" },
        query: { view: "current", status: "In_Progress", page: "3", limit: "4" },
      },
      response,
    );

    const { capturedFilter, capturedQuery } = getCaptured();
    assert.equal(response.statusCode, 200);
    assert.equal(capturedFilter.status, "In_Progress");
    assert.equal(capturedQuery.skip, 8);
    assert.equal(capturedQuery.limit, 4);
    assert.equal(response.payload.pagination.page, 3);
    assert.equal(response.payload.pagination.hasPreviousPage, true);
  });
});

test("staff endpoint rejects unsupported status filters", async () => {
  const response = makeResponse();
  await getStaffAssigned(
    {
      auth: { id: "507f191e810c19729de860ea", role: "staff" },
      query: { view: "current", status: "Not_A_Status" },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /valid current complaint status/);
});

test("student complaint history searches and paginates the selected view", async () => {
  const token = jwt.sign(
    { id: "507f191e810c19729de860ea", role: "student" },
    config.JWT_SECRET,
  );

  await withComplaintStubs({ documents: [{ _id: "complaint-3" }], total: 13 }, async (getCaptured) => {
    const response = makeResponse();
    await getStudentComplaints(
      {
        accessToken: token,
        query: { view: "resolved", page: "2", limit: "6", search: "water" },
      },
      response,
    );

    const { capturedFilter, capturedQuery } = getCaptured();
    assert.equal(response.statusCode, 200);
    assert.equal(capturedFilter.status, "Resolved");
    assert.equal(capturedFilter.$or[0].complaintTitle.test("WATER problem"), true);
    assert.equal(capturedQuery.skip, 6);
    assert.equal(capturedQuery.limit, 6);
    assert.equal(response.payload.pagination.total, 13);
  });
});
