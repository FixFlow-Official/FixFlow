const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AssistantServiceError,
  parseAssistantActions,
  buildSystemInstruction,
  generateAssistantReply,
  generateVoiceComplaintTurn,
  diagnoseComplaintImage,
  formatStaffVoiceNote,
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

test("parseAssistantActions extracts action tags and cleans text", () => {
  const text = 'I have filtered the list for you. [[ACTION:filter category="Electrical" status="Assigned"]] [[ACTION:navigate target="complaints"]] Let me know if you need more help.';
  const { cleanText, actions } = parseAssistantActions(text);

  assert.equal(cleanText, "I have filtered the list for you. Let me know if you need more help.");
  assert.deepEqual(actions, [
    { type: "filter", params: { category: "Electrical", status: "Assigned" } },
    { type: "navigate", params: { target: "complaints" } },
  ]);
});

test("diagnoseComplaintImage returns structured diagnosis from Gemini Vision", async () => {
  const fakeImageBuffer = Buffer.from("fake-image-bytes");
  let capturedBody;

  const result = await diagnoseComplaintImage({
    imageBuffer: fakeImageBuffer,
    mimeType: "image/jpeg",
    apiKey: "test-secret",
    model: "gemini-3.5-flash-lite",
    fetchImpl: async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "Burnt 16A Wall Socket",
                      category: "Electrical",
                      severity: "High",
                      description: "The 16A wall switchboard socket shows severe burn and charring marks. The faceplate is cracked and requires immediate replacement.",
                      safetyWarning: "Fire and shock hazard. Keep students away.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    },
  });

  assert.equal(result.title, "Burnt 16A Wall Socket");
  assert.equal(result.category, "Electrical");
  assert.equal(result.severity, "High");
  assert.match(result.description, /socket shows severe burn/);
  assert.equal(result.safetyWarning, "Fire and shock hazard. Keep students away.");
  assert.equal(result.source, "gemini");

  // Verify inlineData was sent
  assert.equal(capturedBody.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
  assert.equal(capturedBody.contents[0].parts[1].inlineData.data, fakeImageBuffer.toString("base64"));
});

test("diagnoseComplaintImage falls back gracefully when key is missing or invalid buffer", async () => {
  const fakeImageBuffer = Buffer.from("fake-image-bytes");
  const fallbackResult = await diagnoseComplaintImage({
    imageBuffer: fakeImageBuffer,
    apiKey: "",
  });
  assert.equal(fallbackResult.source, "heuristic");
  assert.equal(fallbackResult.category, "Other");

  await assert.rejects(
    diagnoseComplaintImage({ imageBuffer: null }),
    /An image file is required/,
  );
});

test("formatStaffVoiceNote formats informal technician voice input", async () => {
  const result = await formatStaffVoiceNote({
    utterance: "Main valve change kar diya hai, water supply testing chal rahi hai",
    status: "In_Progress",
    complaintTitle: "Water leak in PG Block washroom",
    apiKey: "test-secret",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Replaced the main water control valve. Currently testing water supply lines for pressure integrity.",
                },
              ],
            },
          },
        ],
      }),
    }),
  });

  assert.equal(
    result.formattedNote,
    "Replaced the main water control valve. Currently testing water supply lines for pressure integrity.",
  );
  assert.equal(result.source, "gemini");
});
