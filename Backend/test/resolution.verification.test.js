const assert = require("node:assert/strict");
const test = require("node:test");
const complaintModel = require("../src/models/complaint.model");
const {
  decideVerdict,
  verifyResolution,
} = require("../src/services/resolutionVerification.service");
const { updateComplaintStatus } = require("../src/controllers/staff.controller");

// Mock storage upload
const storageModulePath = require.resolve("../src/services/storage.service");
require.cache[storageModulePath].exports = async () => ({
  url: "https://ik.imagekit.io/campus/resolution-after.jpg",
});

test("decideVerdict enforces strict boundaries at 70 and 40", () => {
  // Boundary at 70: VERIFIED only if sameAsset=true, visibleFixEvidence=true, score >= 70
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: true, confidenceScore: 70 }),
    "VERIFIED",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: true, confidenceScore: 85 }),
    "VERIFIED",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: true, confidenceScore: 69 }),
    "INCONCLUSIVE",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: false, confidenceScore: 75 }),
    "INCONCLUSIVE",
  );

  // Boundary at 40: MISMATCH if sameAsset=false OR score < 40
  assert.equal(
    decideVerdict({ sameAsset: false, visibleFixEvidence: true, confidenceScore: 90 }),
    "MISMATCH",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: false, confidenceScore: 39 }),
    "MISMATCH",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: true, confidenceScore: 39 }),
    "MISMATCH",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: false, confidenceScore: 40 }),
    "INCONCLUSIVE",
  );
  assert.equal(
    decideVerdict({ sameAsset: true, visibleFixEvidence: false, confidenceScore: 55 }),
    "INCONCLUSIVE",
  );
});

test("verifyResolution returns INCONCLUSIVE when image fetch fails", async () => {
  const failingFetch = async () => ({
    ok: false,
    status: 404,
  });

  const result = await verifyResolution({
    beforeImageUrl: "https://ik.imagekit.io/campus/before.jpg",
    afterImageUrl: "https://ik.imagekit.io/campus/after.jpg",
    title: "Broken Fan",
    fetchImpl: failingFetch,
  });

  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(result.confidenceScore, 0);
  assert.equal(result.provider, "none");
  assert.match(result.reasons[0], /Could not load one of the photos/);
});

test("verifyResolution returns INCONCLUSIVE when GEMINI_API_KEY is missing", async () => {
  const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const mockFetch = async (url) => {
    return {
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => sampleJpeg.buffer,
    };
  };

  const result = await verifyResolution({
    beforeImageUrl: "https://ik.imagekit.io/campus/before.jpg",
    afterImageUrl: "https://ik.imagekit.io/campus/after.jpg",
    title: "Broken Chair",
    apiKey: "",
    fetchImpl: mockFetch,
  });

  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(result.confidenceScore, 50);
  assert.equal(result.provider, "rules");
  assert.match(result.reasons[0], /AI service not configured/);
});

test("verifyResolution parses Gemini visual comparison response accurately", async () => {
  const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const mockFetch = async (url, options) => {
    if (typeof url === "string" && url.includes("googleapis.com")) {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sameAsset: true,
                      visibleFixEvidence: true,
                      confidenceScore: 88,
                      reasons: ["The same classroom desk is shown.", "The broken leg is visibly repaired with a bracket."],
                      observedAsset: "Student Desk in Room 102",
                      observedIssueFixed: "Wobbly broken wooden leg reinforced with metal corner bracket",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    }

    return {
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => sampleJpeg.buffer,
    };
  };

  const result = await verifyResolution({
    beforeImageUrl: "https://ik.imagekit.io/campus/before.jpg",
    afterImageUrl: "https://ik.imagekit.io/campus/after.jpg",
    title: "Broken wooden desk",
    apiKey: "dummy-key",
    fetchImpl: mockFetch,
  });

  assert.equal(result.verdict, "VERIFIED");
  assert.equal(result.confidenceScore, 88);
  assert.equal(result.provider, "gemini");
  assert.equal(result.observedAsset, "Student Desk in Room 102");
  assert.equal(result.reasons.length, 2);
});

test("staff resolve: MISMATCH does not change status to Resolved, returns 409, stays In_Progress", async () => {
  const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const originalFetch = global.fetch;

  global.fetch = async (url) => {
    if (typeof url === "string" && url.includes("googleapis.com")) {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sameAsset: false,
                      visibleFixEvidence: false,
                      confidenceScore: 25,
                      reasons: ["Photo 1 shows a ceiling fan, but Photo 2 shows the floor tiles."],
                      observedAsset: "Floor tiles",
                      observedIssueFixed: "None",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    }

    return {
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => sampleJpeg.buffer,
    };
  };

  const mockComplaint = {
    _id: "507f1f77bcf86cd799439011",
    userRef: "student",
    assignedStaff: "507f191e810c19729de860ea",
    status: "In_Progress",
    complaintTitle: "Noisy Ceiling Fan",
    complaintDescription: "The ceiling fan in Room 302 makes screeching sounds.",
    category: "Electrical",
    complaintPictureUrl: "https://ik.imagekit.io/campus/before-fan.jpg",
    resolutionVerified: false,
    statusHistory: [],
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
  };

  const originalFindOne = complaintModel.findOne;
  complaintModel.findOne = async () => mockComplaint;

  try {
    const response = {
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

    const req = {
      auth: { id: "507f191e810c19729de860ea", role: "staff" },
      params: { complaintId: "507f1f77bcf86cd799439011" },
      body: { status: "Resolved", note: "Replaced capacitor and verified." },
      file: { buffer: Buffer.from("image file bytes") },
    };

    await updateComplaintStatus(req, response);

    assert.equal(response.statusCode, 409);
    assert.match(response.payload.message, /Resolution photo does not match/);
    assert.equal(response.payload.verification.verdict, "MISMATCH");
    assert.equal(mockComplaint.status, "In_Progress");
    assert.equal(mockComplaint.resolutionVerified, false);
    assert.equal(mockComplaint.saveCalls, 1);
  } finally {
    global.fetch = originalFetch;
    complaintModel.findOne = originalFindOne;
  }
});
