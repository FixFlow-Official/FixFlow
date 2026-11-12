const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const broadcastController = require("../src/controllers/broadcast.controller");
const { broadcastModel } = require("../src/models/broadcast.model");

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

test("Admin can create campus outage broadcast", async () => {
  const adminId = new mongoose.Types.ObjectId();
  const originalCreate = broadcastModel.create;

  const now = new Date();
  const startsAt = new Date(now.getTime() + 10 * 60 * 1000);
  const endsAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  let createdPayload = null;
  broadcastModel.create = async (doc) => {
    createdPayload = doc;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      createdAt: new Date(),
    };
  };

  try {
    const req = {
      auth: { id: adminId, role: "admin" },
      body: {
        title: "Central Library Wi-Fi Maintenance",
        message: "Network switch upgrade in progress until 4 PM.",
        category: "Internet",
        buildings: ["Central Library"],
        startsAt,
        endsAt,
      },
    };
    const res = createMockRes();

    await broadcastController.createBroadcast(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.message, "Broadcast created successfully.");
    assert.ok(res.payload.broadcast);
    assert.equal(createdPayload.title, "Central Library Wi-Fi Maintenance");
    assert.equal(createdPayload.category, "Internet");
    assert.deepEqual(createdPayload.buildings, ["Central Library"]);
    assert.equal(createdPayload.createdBy, adminId);
  } finally {
    broadcastModel.create = originalCreate;
  }
});

test("Student cannot create broadcast and receives 403 Forbidden", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const req = {
    auth: { id: studentId, role: "student" },
    body: {
      title: "Student Outage Notice",
      message: "Trying to broadcast as a student.",
      category: "Electrical",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 3600000),
    },
  };
  const res = createMockRes();

  await broadcastController.createBroadcast(req, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /only administrators/i);
});

test("endsAt <= startsAt returns 400 Bad Request with clear validation message", async () => {
  const adminId = new mongoose.Types.ObjectId();
  const now = new Date();

  // Test endsAt before startsAt
  {
    const req = {
      auth: { id: adminId, role: "admin" },
      body: {
        title: "Invalid Timing Outage",
        message: "Maintenance ends before it starts.",
        category: "Plumbing",
        startsAt: new Date(now.getTime() + 2 * 3600000),
        endsAt: new Date(now.getTime() + 1 * 3600000), // earlier
      },
    };
    const res = createMockRes();
    await broadcastController.createBroadcast(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.payload.message, /end time must be after start time/i);
  }

  // Test endsAt equals startsAt
  {
    const req = {
      auth: { id: adminId, role: "admin" },
      body: {
        title: "Zero Duration Outage",
        message: "Maintenance ends at same time it starts.",
        category: "Cleaning",
        startsAt: now,
        endsAt: now,
      },
    };
    const res = createMockRes();
    await broadcastController.createBroadcast(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.payload.message, /end time must be after start time/i);
  }
});

test("Active endpoint returns only currently active broadcasts and hides expired ones", async () => {
  const originalFind = broadcastModel.find;
  let interceptedQuery = null;

  const mockActiveBroadcast = {
    _id: new mongoose.Types.ObjectId(),
    title: "Live Water Pump Servicing",
    message: "Water pressure will be low across PG Block.",
    category: "Plumbing",
    buildings: ["PG Block"],
    startsAt: new Date(Date.now() - 3600000),
    endsAt: new Date(Date.now() + 3600000),
    isActive: true,
  };

  broadcastModel.find = (query) => {
    interceptedQuery = query;
    return {
      sort: () => ({
        lean: async () => [mockActiveBroadcast],
      }),
    };
  };

  try {
    const req = {
      auth: { id: new mongoose.Types.ObjectId(), role: "student" },
    };
    const res = createMockRes();

    await broadcastController.getActiveBroadcasts(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.broadcasts.length, 1);
    assert.equal(res.payload.broadcasts[0].title, "Live Water Pump Servicing");

    // Verify database query enforces isActive: true and time boundaries
    assert.equal(interceptedQuery.isActive, true);
    assert.ok(interceptedQuery.startsAt.$lte);
    assert.ok(interceptedQuery.endsAt.$gte);
  } finally {
    broadcastModel.find = originalFind;
  }
});

test("Match endpoint matches building + category and ignores non-matching buildings", async () => {
  const originalFind = broadcastModel.find;
  let interceptedQuery = null;

  const libraryOutage = {
    _id: new mongoose.Types.ObjectId(),
    title: "Central Library Switch Maintenance",
    message: "Wi-Fi down on 2nd and 3rd floors.",
    category: "Internet",
    buildings: ["Central Library"],
    startsAt: new Date(Date.now() - 10000),
    endsAt: new Date(Date.now() + 7200000),
    isActive: true,
  };

  broadcastModel.find = (query) => {
    interceptedQuery = query;
    // Check if query building matches Central Library
    const isLibraryQuery = query.$or?.some(
      (clause) => clause.buildings instanceof RegExp && clause.buildings.test("Central Library"),
    );

    return {
      sort: () => ({
        lean: async () => (isLibraryQuery ? [libraryOutage] : []),
      }),
    };
  };

  try {
    // 1. Matches Central Library + Internet
    {
      const req = {
        auth: { id: new mongoose.Types.ObjectId(), role: "student" },
        query: {
          category: "Internet",
          building: "Central Library",
        },
      };
      const res = createMockRes();

      await broadcastController.getMatchingBroadcasts(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.matched, true);
      assert.ok(res.payload.match);
      assert.equal(res.payload.match.title, "Central Library Switch Maintenance");
      assert.equal(interceptedQuery.category, "Internet");
    }

    // 2. Ignores Science Block (different building)
    {
      const req = {
        auth: { id: new mongoose.Types.ObjectId(), role: "student" },
        query: {
          category: "Internet",
          building: "Science Block",
        },
      };
      const res = createMockRes();

      await broadcastController.getMatchingBroadcasts(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.matched, false);
      assert.equal(res.payload.match, null);
    }
  } finally {
    broadcastModel.find = originalFind;
  }
});

test("Match endpoint matches whole-campus broadcast (empty buildings array) for any building", async () => {
  const originalFind = broadcastModel.find;

  const campusPowerOutage = {
    _id: new mongoose.Types.ObjectId(),
    title: "Campus-Wide Power Grid Maintenance",
    message: "DG backup active across all blocks.",
    category: "Electrical",
    buildings: [], // empty = whole campus
    startsAt: new Date(Date.now() - 10000),
    endsAt: new Date(Date.now() + 7200000),
    isActive: true,
  };

  broadcastModel.find = () => ({
    sort: () => ({
      lean: async () => [campusPowerOutage],
    }),
  });

  try {
    const req = {
      auth: { id: new mongoose.Types.ObjectId(), role: "student" },
      query: {
        category: "Electrical",
        building: "Mechanical Workshop Block C",
      },
    };
    const res = createMockRes();

    await broadcastController.getMatchingBroadcasts(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.matched, true);
    assert.ok(res.payload.match);
    assert.equal(res.payload.match.title, "Campus-Wide Power Grid Maintenance");
  } finally {
    broadcastModel.find = originalFind;
  }
});

