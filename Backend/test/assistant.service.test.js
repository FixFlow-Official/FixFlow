const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AssistantServiceError,
  buildSystemInstruction,
  generateAssistantReply,
} = require("../src/services/assistant.service");
const { validateMessages } = require("../src/controllers/assistant.controller");

test("assistant system instruction is role-aware and protects private data", () => {
  assert.match(buildSystemInstruction("student"), /student/i);
  assert.match(buildSystemInstruction("staff"), /assigned complaints/i);
  assert.match(buildSystemInstruction("admin"), /SLA tracking/i);
  assert.match(buildSystemInstruction("admin"), /cannot see account or complaint records/i);
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
