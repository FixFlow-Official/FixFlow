const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeRoom,
  normalizeBuilding,
  extractConcepts,
  calculateDuplicateScore,
  findDuplicates,
} = require("../src/services/duplicateDetection.service");

test("normalizeRoom handles prefixes, whitespace, and formatting", () => {
  assert.equal(normalizeRoom("Room 101"), "101");
  assert.equal(normalizeRoom("rm #204"), "204");
  assert.equal(normalizeRoom("Lab 2"), "2");
  assert.equal(normalizeRoom("Physics Lab 204"), "physics204");
  assert.equal(normalizeRoom("  305-B  "), "305b");
  assert.equal(normalizeRoom(null), "");
  assert.equal(normalizeRoom(undefined), "");
  assert.equal(normalizeRoom(""), "");
});

test("normalizeBuilding handles abbreviations and aliases", () => {
  assert.equal(normalizeBuilding("PG Block"), "pgblock");
  assert.equal(normalizeBuilding("pg-block"), "pgblock");
  assert.equal(normalizeBuilding("Central Library"), "centrallibrary");
  assert.equal(normalizeBuilding(""), "");
  assert.equal(normalizeBuilding(null), "");
});

test("extractConcepts extracts concepts and tokens according to domain synonym dictionaries", () => {
  const analysis1 = extractConcepts("The wifi router in room 101 has no internet connectivity");
  assert.ok(analysis1.concepts.has("wifi"), "should detect wifi concept");
  assert.ok(analysis1.tokens.size > 0, "should produce token set");

  const analysis2 = extractConcepts("Water leaking from washroom flush pipe and faucet");
  assert.ok(analysis2.concepts.has("water"), "should detect water concept");

  const analysis3 = extractConcepts("Ceiling fan switch is sparking and socket broken");
  assert.ok(analysis3.concepts.has("power"), "should detect electrical power concept");

  const analysis4 = extractConcepts("AC remote is not cooling the classroom");
  assert.ok(analysis4.concepts.has("ac"), "should detect ac concept");
});

test("calculateDuplicateScore identifies identical issues in the same room", () => {
  const draft = {
    building: "PG Block",
    floor: "1st Floor",
    room: "101",
    category: "Internet",
    title: "Wi-Fi not working",
    description: "The wifi router is disconnected and internet is down",
  };

  const existing = {
    location: {
      building: "PG Block",
      floor: "1st Floor",
      room: "101",
    },
    category: "Internet",
    complaintTitle: "Problem in WiFi",
    complaintDescription: "Internet connectivity down in room 101",
  };

  const result = calculateDuplicateScore(draft, existing);
  assert.equal(result.isDuplicate, true);
  assert.ok(result.score >= 0.65, `Expected score >= 0.65, got ${result.score}`);
  assert.ok(result.reason.includes("Same room"));
});

test("calculateDuplicateScore distinguishes different locations or distinct issues", () => {
  const draft = {
    building: "PG Block",
    floor: "1st Floor",
    room: "101",
    category: "Electrical",
    title: "Tube light flickering",
    description: "The tubelight is blinking constantly",
  };

  const existingDifferentRoom = {
    location: {
      building: "PG Block",
      floor: "3rd Floor",
      room: "305",
    },
    category: "Electrical",
    complaintTitle: "Fan switch broken",
    complaintDescription: "Switch is not working in room 305",
  };

  const result = calculateDuplicateScore(draft, existingDifferentRoom);
  assert.equal(result.isDuplicate, false);
  assert.ok(result.score < 0.65);
});

test("findDuplicates sorts and flags active duplicates in a location", async () => {
  const draft = {
    building: "Science Block",
    room: "Lab 1",
    category: "Plumbing",
    title: "Water tap leaking",
    description: "Basin pipe is leaking water all over the floor",
  };

  const activeComplaints = [
    {
      _id: "comp-1",
      location: { building: "Science Block", room: "Lab 1" },
      category: "Plumbing",
      complaintTitle: "Leaking tap in lab 1",
      complaintDescription: "Washroom basin pipe leakage",
    },
    {
      _id: "comp-2",
      location: { building: "Science Block", room: "Room 202" },
      category: "Plumbing",
      complaintTitle: "Sink clogged",
      complaintDescription: "Sink in 202 clogged",
    },
  ];

  const result = await findDuplicates(draft, activeComplaints, { useAi: false });
  assert.equal(result.isDuplicate, true);
  assert.equal(result.topDuplicate._id, "comp-1");
  assert.ok(result.topScore >= 0.65);
  assert.equal(result.duplicates.length, 1);
});

test("findDuplicates returns clean false when empty list or no draft provided", async () => {
  const res1 = await findDuplicates(null, []);
  assert.deepEqual(res1, { isDuplicate: false, topDuplicate: null, duplicates: [] });

  const res2 = await findDuplicates({ title: "Issue" }, []);
  assert.deepEqual(res2, { isDuplicate: false, topDuplicate: null, duplicates: [] });
});
