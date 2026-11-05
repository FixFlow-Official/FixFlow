const ROLE_GUIDANCE = {
  student: "The user is a student. Help with submitting and tracking complaints, profile settings, and notification setup.",
  staff: "The user is a staff member. Help with reviewing assigned complaints, recording status updates, and communicating clearly with students.",
  admin: "The user is an administrator. Help with complaint assignment, SLA tracking, reports, directory and account management.",
};

const ASSISTANT_INSTRUCTIONS = [
  "You are the FixFlow assistant, a concise and friendly guide for a campus complaint-management app.",
  "Answer in the language and tone the user uses; Hindi, Hinglish, and English are all welcome.",
  "Help explain how to use FixFlow and give practical complaint-workflow guidance.",
  "FixFlow provides AI complaint triage recommendations for priority, urgency, suggested category, safety concerns, and missing details. Explain these as advisory only; staff/admin make final decisions.",
  "You cannot see account or complaint records, change data, send notifications, or perform actions. Never claim that you did.",
  "Do not ask for or repeat passwords, OTPs, student IDs, email addresses, or other identifying complaint details.",
  "Do not decide whether a complaint is genuine or make consequential decisions about a person. Explain that staff/admin review is required.",
  "For an immediate safety emergency, tell the user to contact campus security or local emergency services directly.",
].join(" ");

class AssistantServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AssistantServiceError";
    this.status = status;
  }
}

function buildSystemInstruction(role) {
  const roleGuidance = ROLE_GUIDANCE[role];
  if (!roleGuidance) throw new AssistantServiceError("Your account role cannot use the assistant.", 403);
  return `${ASSISTANT_INSTRUCTIONS} ${roleGuidance}`;
}

async function generateAssistantReply({
  apiKey,
  model = "gemini-3.5-flash-lite",
  role,
  messages,
  fetchImpl = fetch,
}) {
  if (!apiKey?.trim()) {
    throw new AssistantServiceError("The FixFlow AI assistant is not configured yet. Add GEMINI_API_KEY to Backend/.env and restart the backend.", 503);
  }

  const systemInstruction = buildSystemInstruction(role);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: messages.map(({ role: messageRole, text }) => ({
          role: messageRole === "assistant" ? "model" : "user",
          parts: [{ text }],
        })),
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 512,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new AssistantServiceError("The AI assistant took too long to respond. Please try again.", 504);
    }
    throw new AssistantServiceError("Could not reach the AI service. Check the backend internet connection and try again.", 502);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new AssistantServiceError("The AI service has reached its current free-tier limit. Please try again after the quota resets.", 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new AssistantServiceError("Gemini rejected the API key. Check GEMINI_API_KEY and its project access in Backend/.env.", 503);
    }
    if (response.status === 404) {
      throw new AssistantServiceError("The configured Gemini model is unavailable. Check GEMINI_MODEL in Backend/.env.", 503);
    }
    throw new AssistantServiceError("The AI service could not complete that request. Please try again.", 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AssistantServiceError("The AI service returned an unreadable response. Please try again.", 502);
  }

  const reply = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new AssistantServiceError("The AI service did not return a response. Please try again.", 502);
  }

  return reply.slice(0, 4000);
}

async function generateComplaintDescriptionDraft({ title, category, role = "student", apiKey, model }) {
  const fallback = `Please inspect and help resolve this issue: “${title}”. [Add the exact location and when it started.] It is affecting [describe the impact]. [Mention any troubleshooting already tried, if relevant.]`;
  try {
    const reply = await generateAssistantReply({
      apiKey,
      model,
      role,
      messages: [{
        role: "user",
        text: [
          "Write only an editable complaint description draft in 2-4 short sentences.",
          "Use only the facts below. Do not invent dates, locations, effects, troubleshooting, injuries, or other events.",
          "Use short bracketed placeholders for missing facts the student should fill in. No heading, markdown, or greeting.",
          `Complaint title: ${title}`,
          `Selected category: ${category || "not selected"}`,
        ].join("\n"),
      }],
    });
    return { description: reply, source: "gemini" };
  } catch {
    return { description: fallback, source: "template" };
  }
}

async function generateStatusNoteDraft({ title, category, status, apiKey, model }) {
  const statusLabel = status.replaceAll("_", " ").toLowerCase();
  const fallback = `This complaint is now ${statusLabel}. [Add the verified work completed, reason for the update, or next step and expected timing.]`;
  try {
    const reply = await generateAssistantReply({
      apiKey,
      model,
      role: "staff",
      messages: [{ role: "user", text: [
        "Draft a concise, student-facing complaint status note (1-3 sentences).",
        "Use only the facts below. Never claim work was completed or a cause was confirmed unless explicitly provided.",
        "Include a short bracketed placeholder for the staff member to fill in verified work or the next step.",
        "Return only the editable note, with no heading or markdown.",
        `Complaint title: ${title}`,
        `Category: ${category || "not provided"}`,
        `New status: ${statusLabel}`,
      ].join("\n") }],
    });
    return { note: reply, source: "gemini" };
  } catch {
    return { note: fallback, source: "template" };
  }
}

async function generateReportInsights({ period, reportData, apiKey, model }) {
  try {
    const reply = await generateAssistantReply({
      apiKey,
      model,
      role: "admin",
      messages: [{ role: "user", text: [
        "Summarize these aggregate campus complaint metrics for an administrator in 3 concise bullet points.",
        "Identify visible patterns and practical follow-up actions. Do not claim causation, invent trends, or expose personal data.",
        "If the dataset is too small or has no trend, say so clearly. Return plain text without markdown symbols.",
        `Period: ${period}`,
        `Aggregate data: ${JSON.stringify(reportData)}`,
      ].join("\n") }],
    });
    return { insights: reply, source: "gemini" };
  } catch {
    return { insights: "AI insights are temporarily unavailable. The charts and totals above are still available.", source: "fallback" };
  }
}

module.exports = {
  AssistantServiceError,
  buildSystemInstruction,
  generateAssistantReply,
  generateComplaintDescriptionDraft,
  generateStatusNoteDraft,
  generateReportInsights,
};
