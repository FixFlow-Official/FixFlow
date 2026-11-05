const ROLE_GUIDANCE = {
  student: "The user is a student. Help with submitting and tracking complaints, profile settings, and notification setup.",
  staff: "The user is a staff member. Help with reviewing assigned complaints, recording status updates, and communicating clearly with students.",
  admin: "The user is an administrator. Help with complaint assignment, SLA tracking, reports, directory and account management.",
};

const ASSISTANT_INSTRUCTIONS = [
  "You are the FixFlow assistant, a concise and friendly guide for a campus complaint-management app.",
  "Answer in the language and tone the user uses; Hindi, Hinglish, and English are all welcome.",
  "Help explain how to use FixFlow and give practical complaint-workflow guidance.",
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

module.exports = {
  AssistantServiceError,
  buildSystemInstruction,
  generateAssistantReply,
};
