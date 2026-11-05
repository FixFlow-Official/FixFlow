const config = require("../config/config");
const { AssistantServiceError, generateAssistantReply } = require("../services/assistant.service");

const allowedRoles = new Set(["student", "staff", "admin"]);
const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1500;
const MAX_CONVERSATION_LENGTH = 6000;

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    return "Send between 1 and 8 recent messages.";
  }

  let totalLength = 0;
  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.text !== "string" ||
      !message.text.trim() ||
      message.text.length > MAX_MESSAGE_LENGTH
    ) {
      return "Each message must contain text of up to 1,500 characters.";
    }
    totalLength += message.text.length;
  }

  if (totalLength > MAX_CONVERSATION_LENGTH) {
    return "This conversation is too long. Start a new chat and try again.";
  }
  if (messages.at(-1)?.role !== "user") {
    return "The latest message must be from you.";
  }

  return null;
}

async function chat(req, res, next) {
  try {
    const role = req.auth?.role;
    if (!allowedRoles.has(role)) {
      return res.status(403).json({ message: "Your account role cannot use the assistant." });
    }

    const validationError = validateMessages(req.body?.messages);
    if (validationError) return res.status(400).json({ message: validationError });

    const reply = await generateAssistantReply({
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
      role,
      messages: req.body.messages.map(({ role: messageRole, text }) => ({
        role: messageRole,
        text: text.trim(),
      })),
    });

    return res.json({ reply });
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = { chat, validateMessages };
