const assert = require("node:assert/strict");
const test = require("node:test");
const campusBlockModel = require("../src/models/campusBlock.model");
const complaintModel = require("../src/models/complaint.model");
const karnalPreset = require("../src/config/karnalCampusPreset");
const {
  getCampusBlocks,
  createCampusBlock,
  updateCampusBlock,
  deleteCampusBlock,
  initKarnalPreset,
  getCampusHeatmap,
} = require("../src/controllers/campus.controller");

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

test("campus blocks auto-initialize Pt. CLS Karnal preset when empty", async () => {
  let countCalled = false;
  let inserted = null;

  await withStubs(
    [
      [
        campusBlockModel,
        {
          countDocuments: async () => {
            countCalled = true;
            return 0;
          },
          insertMany: async (items) => {
            inserted = items;
            return items;
          },
          find: () => ({
            sort: () => ({
              lean: async () => karnalPreset,
            }),
          }),
        },
      ],
    ],
    async () => {
      const res = makeResponse();
      await getCampusBlocks({}, res);

      assert.equal(res.statusCode, 200);
      assert.equal(countCalled, true);
      assert.equal(inserted?.length, karnalPreset.length);
      assert.equal(res.payload.blocks.length, karnalPreset.length);
    },
  );
});

test("admin can create a new building with floors and room numbers", async () => {
  let createdPayload = null;

  await withStubs(
    [
      [
        campusBlockModel,
        {
          create: async (data) => {
            createdPayload = data;
            return { _id: "b-101", ...data };
          },
        },
      ],
    ],
    async () => {
      const req = {
        body: {
          name: "New Examination Wing",
          shortName: "Exam Wing",
          code: "EXAM",
          category: "Academic",
          position: { x: 50, y: 50, width: 25, height: 25 },
          floors: [
            { name: "Ground Floor", rooms: ["Hall 1", "Hall 2"] },
            { name: "1st Floor", rooms: ["Confidential Room", "Room 101"] },
          ],
        },
      };
      const res = makeResponse();
      await createCampusBlock(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(createdPayload.name, "New Examination Wing");
      assert.equal(createdPayload.floors.length, 2);
      assert.deepEqual(createdPayload.floors[0].rooms, ["Hall 1", "Hall 2"]);
    },
  );
});

test("admin block creation rejects missing name", async () => {
  const req = { body: { name: "   " } };
  const res = makeResponse();
  await createCampusBlock(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, "Building name is required.");
});

test("campus heatmap detects systemic hotspot failure for clustered category issues", async () => {
  const mockBlocks = [
    {
      _id: "block-comm",
      name: "Commerce Block (Block B)",
      shortName: "Commerce Block",
      code: "COMM-B",
      category: "Academic",
      accentColor: "blue",
      position: { x: 38, y: 34, width: 24, height: 28 },
      floors: [
        { name: "Ground Floor", rooms: ["Room B-01", "Room B-02"] },
        { name: "2nd Floor", rooms: ["Room B-21", "Room B-22"] },
      ],
    },
  ];

  // 4 Plumbing complaints on 2nd Floor -> triggers systemic hotspot
  const mockComplaints = [
    {
      complaintTitle: "Water leakage near washroom",
      category: "Plumbing",
      location: { building: "Commerce Block (Block B)", floor: "2nd Floor", room: "Room B-21" },
      aiTriage: { urgency: "High" },
    },
    {
      complaintTitle: "No water in taps",
      category: "Plumbing",
      location: { building: "Commerce Block (Block B)", floor: "2nd Floor", room: "Room B-22" },
      aiTriage: { urgency: "Normal" },
    },
    {
      complaintTitle: "Leaking pipe under sink",
      category: "Plumbing",
      location: { building: "Commerce Block (Block B)", floor: "2nd Floor", room: "Corridor" },
      aiTriage: { urgency: "Normal" },
    },
    {
      complaintTitle: "Low pressure in 2nd floor washroom",
      category: "Plumbing",
      location: { building: "Commerce Block (Block B)", floor: "2nd Floor", room: "Washroom" },
      aiTriage: { urgency: "Critical" },
    },
  ];

  await withStubs(
    [
      [
        campusBlockModel,
        {
          countDocuments: async () => 1,
          find: () => ({
            lean: async () => mockBlocks,
          }),
        },
      ],
      [
        complaintModel,
        {
          find: () => ({
            select: () => ({
              lean: async () => mockComplaints,
            }),
          }),
        },
      ],
    ],
    async () => {
      const res = makeResponse();
      await getCampusHeatmap({}, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.totalActiveComplaints, 4);
      assert.equal(res.payload.systemicIncidentsCount, 1);

      const commBlock = res.payload.blocks[0];
      assert.equal(commBlock.heatLevel, "danger");
      assert.ok(commBlock.systemicHotspot);
      assert.equal(commBlock.systemicHotspot.category, "Plumbing");
      assert.equal(commBlock.systemicHotspot.floor, "2nd Floor");
      assert.equal(commBlock.systemicHotspot.count, 4);
    },
  );
});
