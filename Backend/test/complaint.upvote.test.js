const assert = require("node:assert/strict");
const test = require("node:test");
const complaintModel = require("../src/models/complaint.model");
const studentModel = require("../src/models/student.model");
const {
  getSimilarComplaints,
  toggleUpvoteComplaint,
  createComplaint,
} = require("../src/controllers/student.controller");
const {
  normalizeRoom,
  calculateDuplicateScore,
  findDuplicates,
} = require("../src/services/duplicateDetection.service");

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

async function withStubs(stubs, action) {
  const originals = new Map();
  for (const [target, methods] of stubs) {
    for (const [method, stubFn] of Object.entries(methods)) {
      originals.set(`${target.name || "obj"}.${method}`, { target, method, fn: target[method] });
      target[method] = stubFn;
    }
  }

  try {
    return await action();
  } finally {
    for (const { target, method, fn } of originals.values()) {
      target[method] = fn;
    }
  }
}

test("getSimilarComplaints returns active complaints matching location", async () => {
  const studentId = "student-101";
  const mockComplaints = [
    {
      _id: "c-1",
      complaintTitle: "Water tap broken in washroom",
      complaintDescription: "Water continuously flowing on 2nd floor",
      category: "Plumbing",
      location: { building: "PG Block", floor: "2nd Floor", room: "Washroom" },
      status: "Submitted",
      user: "student-other",
      upvoteCount: 3,
      upvotes: [{ user: studentId }],
      createdAt: new Date(),
    },
  ];

  await withStubs(
    [
      [
        complaintModel,
        {
          find: () => ({
            select: () => ({
              sort: () => ({
                limit: () => ({
                  lean: async () => mockComplaints,
                }),
              }),
            }),
          }),
        },
      ],
    ],
    async () => {
      const req = {
        auth: { id: studentId, role: "student" },
        query: { building: "PG Block", floor: "2nd Floor" },
      };
      const res = makeResponse();
      await getSimilarComplaints(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.complaints.length, 1);
      assert.equal(res.payload.complaints[0].title, "Water tap broken in washroom");
      assert.equal(res.payload.complaints[0].hasUpvoted, true);
      assert.equal(res.payload.complaints[0].isOwner, false);
      assert.equal(res.payload.complaints[0].upvoteCount, 3);
    },
  );
});

test("toggleUpvoteComplaint increments upvoteCount and adds student to upvotes", async () => {
  const studentId = "student-202";
  const complaint = {
    _id: "c-2",
    user: "student-creator",
    status: "Submitted",
    upvoteCount: 1,
    upvotes: [{ user: "student-initial" }],
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
  };

  await withStubs(
    [
      [
        complaintModel,
        {
          findById: async () => complaint,
        },
      ],
    ],
    async () => {
      const req = {
        auth: { id: studentId, role: "student" },
        params: { complaintId: "c-2" },
      };
      const res = makeResponse();
      await toggleUpvoteComplaint(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.upvoted, true);
      assert.equal(res.payload.upvoteCount, 2);
      assert.equal(complaint.saveCalls, 1);
      assert.equal(complaint.upvotes.length, 2);

      // Toggling again removes the upvote
      const res2 = makeResponse();
      await toggleUpvoteComplaint(req, res2);

      assert.equal(res2.statusCode, 200);
      assert.equal(res2.payload.upvoted, false);
      assert.equal(res2.payload.upvoteCount, 1);
      assert.equal(complaint.saveCalls, 2);
      assert.equal(complaint.upvotes.length, 1);
    },
  );
});

test("toggleUpvoteComplaint rejects self-upvoting by the complaint creator", async () => {
  const creatorId = "student-creator";
  const complaint = {
    _id: "c-3",
    user: creatorId,
    status: "Submitted",
    upvotes: [],
  };

  await withStubs(
    [
      [
        complaintModel,
        {
          findById: async () => complaint,
        },
      ],
    ],
    async () => {
      const req = {
        auth: { id: creatorId, role: "student" },
        params: { complaintId: "c-3" },
      };
      const res = makeResponse();
      await toggleUpvoteComplaint(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.payload.message, "You are the creator of this complaint.");
    },
  );
});

test("toggleUpvoteComplaint rejects upvoting a resolved complaint", async () => {
  const studentId = "student-other";
  const complaint = {
    _id: "c-4",
    user: "student-creator",
    status: "Resolved",
    upvotes: [],
  };

  await withStubs(
    [
      [
        complaintModel,
        {
          findById: async () => complaint,
        },
      ],
    ],
    async () => {
      const req = {
        auth: { id: studentId, role: "student" },
        params: { complaintId: "c-4" },
      };
      const res = makeResponse();
      await toggleUpvoteComplaint(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.payload.message, "Cannot upvote a closed or resolved complaint.");
    },
  );
});

test("duplicateDetection normalizes room numbers and identifies campus concept synonyms", () => {
  assert.equal(normalizeRoom("Room number e28"), "e28");
  assert.equal(normalizeRoom("Room E28"), "e28");
  assert.equal(normalizeRoom("e-28"), "e28");
  assert.equal(normalizeRoom("Physics Lab 204"), "physics204");

  // Exact real-life user case: "Wifi Problem" vs "My Wi-Fi is not working" in PG Block
  const existingComplaint = {
    _id: "c-wifi-1",
    complaintTitle: "Wifi Problem",
    complaintDescription: "Campus wifi is not connecting in Room E28",
    category: "Internet",
    location: { building: "PG Block", floor: "Ground Floor", room: "Room E28" },
    status: "Submitted",
  };

  const newDraft = {
    title: "My Wi-Fi is not working",
    description: "Wi-Fi is not working from the last 24 hours.",
    category: "Internet",
    building: "PG block",
    floor: "Ground Floor",
    room: "Room number e28",
  };

  const evalResult = calculateDuplicateScore(newDraft, existingComplaint);
  assert.equal(evalResult.isDuplicate, true);
  assert.ok(evalResult.score >= 0.85);

  // Another real-life user case: "Problem In wifi" (building-level) vs "Wifi Problem"
  const draftBuildingLevel = {
    title: "Problem In wifi",
    description: "The Wi-Fi network at location is not working properly.",
    category: "Internet",
    building: "PG Block",
    floor: "Ground Floor",
    room: "",
  };

  const evalBuilding = calculateDuplicateScore(draftBuildingLevel, existingComplaint);
  assert.equal(evalBuilding.isDuplicate, true);
});

test("duplicateDetection distinguishes completely different issues in the same room", () => {
  const existingWifi = {
    _id: "c-wifi-1",
    complaintTitle: "Wifi Problem",
    complaintDescription: "Campus wifi is not connecting",
    category: "Internet",
    location: { building: "PG Block", floor: "Ground Floor", room: "Room E28" },
    status: "Submitted",
  };

  // Water problem in the same room is NOT a duplicate of Wi-Fi problem
  const waterDraft = {
    title: "Water Problem",
    description: "There is a water supply issue, tap continuously leaking.",
    category: "Plumbing",
    building: "PG Block",
    floor: "Ground Floor",
    room: "Room E28",
  };

  const evalWater = calculateDuplicateScore(waterDraft, existingWifi);
  assert.equal(evalWater.isDuplicate, false);
});

test("duplicateDetection distinguishes same issue in different buildings", () => {
  const existingWifiPG = {
    _id: "c-wifi-1",
    complaintTitle: "Wifi Problem",
    category: "Internet",
    location: { building: "PG Block", floor: "Ground Floor", room: "Room E28" },
    status: "Submitted",
  };

  const scienceDraft = {
    title: "Wifi Problem",
    category: "Internet",
    building: "Science Block & Laboratories",
    floor: "1st Floor",
    room: "Room 101",
  };

  const evalScience = calculateDuplicateScore(scienceDraft, existingWifiPG);
  assert.equal(evalScience.isDuplicate, false);
});

test("createComplaint rejects duplicate submission with 409 Conflict and provides duplicate details", async () => {
  const studentId = "student-duplicate-tester";
  const user = { _id: studentId, username: "Kohinoor Singh", rollno: 12345, email: "k@test.com", role: "student" };

  const existingComplaint = {
    _id: "c-existing-wifi",
    complaintTitle: "Wifi Problem",
    complaintDescription: "Campus wifi is down",
    category: "Internet",
    location: { building: "PG Block", floor: "Ground Floor", room: "Room E28" },
    status: "Submitted",
    user: "other-student",
    upvoteCount: 4,
  };

  await withStubs(
    [
      [studentModel, { findById: async () => user }],
      [
        complaintModel,
        {
          find: () => ({
            select: () => ({
              lean: async () => [existingComplaint],
            }),
          }),
          countDocuments: async () => 1,
        },
      ],
    ],
    async () => {
      const req = {
        auth: { id: studentId, role: "student" },
        body: {
          title: "My Wi-Fi is not working",
          description: "Wi-Fi is not working from the last 24 hours.",
          category: "Internet",
          building: "PG block",
          floor: "Ground Floor",
          room: "Room number e28",
        },
        file: { buffer: Buffer.from("fake-image") },
      };
      const res = makeResponse();
      await createComplaint(req, res);

      assert.equal(res.statusCode, 409);
      assert.equal(res.payload.isDuplicate, true);
      assert.equal(res.payload.duplicateComplaint._id, "c-existing-wifi");
      assert.match(res.payload.message, /similar active complaint is already open/i);
    },
  );
});

