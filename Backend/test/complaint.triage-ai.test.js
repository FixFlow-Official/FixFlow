const assert = require("node:assert/strict");
const test = require("node:test");
const {
  fallbackTriage,
  fingerprintComplaint,
  normalizeTriage,
  triageComplaint,
} = require("../src/services/complaintTriage.service");

test("triage fallback flags unclear and obvious test reports without calling them false", () => {
  const unclear = fallbackTriage({ title: "Facilities", description: "test", category: "Other" });
  assert.equal(unclear.reviewSignal, "check_relevance");
  assert.doesNotMatch(unclear.reviewSignalReason, /fake|dishonest|false/i);

  const useful = fallbackTriage({
    title: "Water leak beside the library",
    description: "A pipe is leaking continuously near the west entrance and the floor is wet. It started this morning and students are walking through the area.",
    category: "Other",
  });
  assert.equal(useful.reviewSignal, "actionable");
  assert.equal(useful.safetyConcern, false);
});

test("Gemini triage normalizes advisory review signals and validates categories", () => {
  const normalized = normalizeTriage({
    suggestedCategory: "Other",
    priority: "P3",
    urgency: "Normal",
    confidence: 0.7,
    summary: "A campus issue needs a closer look.",
    missingInformation: ["When did it begin?"],
    safetyConcern: false,
    rationale: "The report does not contain an immediate safety signal.",
    reviewSignal: "needs_details",
    reviewSignalReason: "Add when the issue began.",
  }, { category: "Plumbing" });
  assert.equal(normalized.reviewSignal, "needs_details");
  assert.equal(normalized.reviewSignalReason, "Add when the issue began.");
  assert.equal(normalizeTriage({ reviewSignal: "fake" }, { category: "Plumbing" }), null);
});

test("triage fingerprints are stable and bind text, category, and building", () => {
  const complaint = { title: " Broken tap ", description: "Water is leaking", category: "Plumbing", building: "Science Block" };
  assert.equal(fingerprintComplaint(complaint), fingerprintComplaint({ ...complaint, title: "Broken tap" }));
  assert.notEqual(fingerprintComplaint(complaint), fingerprintComplaint({ ...complaint, building: "Library" }));
});

test("AI triage falls back safely when Gemini has no key or fails", async () => {
  const input = { title: "Broken fan", description: "The classroom fan is not working", category: "Other" };
  const result = await triageComplaint(input, { apiKey: "", fetchImpl: async () => assert.fail("must not call Gemini") });
  assert.equal(result.provider, "rules");
  assert.equal(result.suggestedCategory, "Electrical");
});
