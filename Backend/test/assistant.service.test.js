const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AssistantServiceError,
  buildSystemInstruction,
  generateAssistantReply,
  generateVoiceComplaintTurn,
} = require("../src/services/assistant.service");
const { validateMessages } = require("../src/controllers/assistant.controller");

test("assistant system instruction is role-aware and protects private data", () => {
  assert.match(buildSystemInstruction("student"), /student/i);
  assert.match(buildSystemInstruction("staff"), /assigned complaints/i);
  assert.match(buildSystemInstruction("admin"), /SLA tracking/i);
  assert.match(buildSystemInstruction("admin"), /cannot access private records/i);
  assert.match(buildSystemInstruction("student"), /professional English/i);
  assert.throws(() => buildSystemInstruction("unknown"), AssistantServiceError);
});

test("assistant validates bounded conversation history and requires a latest user message", () => {
  assert.equal(validateMessages([{ role: "user", text: "Hello" }]), null);
  assert.match(validateMessages([]), /between 1 and 8/);
  assert.match(validateMessages([{ role: "assistant", text: "Hello" }]), /latest message/);
  assert.match(validateMessages([{ role: "user", text: "x".repeat(1501) }]), /1,500 characters/);
  assert.match(validateMessages(Array.from({ length: 9 }, () => ({ role: "user", text: "Hi" }))), /between 1 and 8/);
});

test("assistant sends only conversation text to Gemini and returns its reply", async () => {
  let request;
  const reply = await generateAssistantReply({
    apiKey: "test-secret",
    model: "gemini-test-model",
    role: "student",
    messages: [
      { role: "user", text: "How do I report a broken light?" },
      { role: "assistant", text: "Use the complaint form." },
      { role: "user", text: "Thanks" },
    ],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "Open Complaints and choose Create complaint." }] } }] }),
      };
    },
  });

  assert.equal(reply, "Open Complaints and choose Create complaint.");
  assert.match(request.url, /gemini-test-model:generateContent$/);
  assert.equal(request.options.headers["x-goog-api-key"], "test-secret");
  const body = JSON.parse(request.options.body);
  assert.match(body.systemInstruction.parts[0].text, /student/i);
  assert.deepEqual(body.contents.map((item) => item.role), ["user", "model", "user"]);
  assert.equal(body.generationConfig.maxOutputTokens, 512);
});

test("assistant handles missing key and provider rate limits without leaking provider details", async () => {
  await assert.rejects(
    generateAssistantReply({ apiKey: "", role: "student", messages: [], fetchImpl: async () => assert.fail("must not call Gemini") }),
    (error) => error instanceof AssistantServiceError && error.status === 503,
  );

  await assert.rejects(
    generateAssistantReply({
      apiKey: "test-secret",
      role: "student",
      messages: [{ role: "user", text: "hello" }],
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "private provider internals" } }) }),
    }),
    (error) => error instanceof AssistantServiceError && error.status === 429 && !error.message.includes("private provider internals"),
  );
});

test("voice complaint turn returns a bounded editable draft and English readback", async () => {
  const result = await generateVoiceComplaintTurn({
    apiKey: "test-secret",
    role: "student",
    utterance: "The classroom projector in Science Block is not turning on",
    draft: { title: "", description: "", category: "", building: "", room: "" },
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.match(body.systemInstruction.parts[0].text, /professional English/i);
      assert.match(body.systemInstruction.parts[0].text, /untrusted report data/i);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        reply: "What room is the projector in, and how is the issue affecting your class?",
        draft: { title: "Projector not working in Science Block", description: "The classroom projector is not turning on. It is affecting the lesson.", category: "Electrical", building: "Science Block", room: "" },
      }) }] } }] }) };
    },
  });
  assert.equal(result.readyForReview, true);
  assert.equal(result.draft.category, "Electrical");
  assert.match(result.reply, /What room/);
  assert.equal(result.draft.description.length <= 2000, true);
});
