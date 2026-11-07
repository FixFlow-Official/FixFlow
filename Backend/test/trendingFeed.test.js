const test = require("node:test");
const assert = require("node:assert/strict");
const complaintModel = require("../src/models/complaint.model");
const { getTrendingComplaints } = require("../src/controllers/student.controller");

function createMockRes() {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  return res;
}

test("getTrendingComplaints returns active complaints sorted by upvoteCount with hasUpvoted flag", async () => {
  const originalFind = complaintModel.find;

  const mockComplaints = [
    {
      _id: "c1",
      ticketNumber: "T-100",
      complaintTitle: "Library 2nd Floor AC not working",
      category: "Electrical",
      location: { building: "Library", room: "201" },
      status: "In_Progress",
      upvoteCount: 15,
      upvotes: [{ user: "student_me" }, { user: "student_other" }],
      user: "student_creator",
      toObject() {
        return { ...this };
      },
    },
    {
      _id: "c2",
      ticketNumber: "T-101",
      complaintTitle: "Hostel Block B Wi-Fi down",
      category: "Internet",
      location: { building: "Hostel B", room: "Common Room" },
      status: "Submitted",
      upvoteCount: 8,
      upvotes: [{ user: "student_other" }],
      user: "student_me",
      toObject() {
        return { ...this };
      },
    },
  ];

  complaintModel.find = (filter) => ({
    sort: () => ({
      limit: () => ({
        select: async () => mockComplaints,
      }),
    }),
  });

  const req = {
    auth: { id: "student_me", role: "student" },
    query: {},
  };
  const res = createMockRes();

  try {
    await getTrendingComplaints(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.total, 2);
    assert.equal(res.payload.complaints[0]._id, "c1");
    assert.equal(res.payload.complaints[0].hasUpvoted, true);
    assert.equal(res.payload.complaints[0].isOwner, false);

    assert.equal(res.payload.complaints[1]._id, "c2");
    assert.equal(res.payload.complaints[1].hasUpvoted, false);
    assert.equal(res.payload.complaints[1].isOwner, true);
  } finally {
    complaintModel.find = originalFind;
  }
});

test("getTrendingComplaints rejects non-student callers with 403", async () => {
  const req = {
    auth: { id: "staff_1", role: "staff" },
    query: {},
  };
  const res = createMockRes();

  await getTrendingComplaints(req, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /Only students/);
});
