const config = require("../config/config");
const jwt = require("jsonwebtoken");
const complaintModel = require("../models/complaint.model");
const {
  AssistantServiceError,
  parseAssistantActions,
  generateAssistantReply,
  generateComplaintDescriptionDraft,
  generateVoiceComplaintTurn,
  generateStatusNoteDraft,
  generateReportInsights,
  diagnoseComplaintImage,
  formatStaffVoiceNote: formatStaffVoiceNoteService,
} = require("../services/assistant.service");
const {
  triageComplaint,
  fingerprintComplaint,
} = require("../services/complaintTriage.service");

const allowedRoles = new Set(["student", "staff", "admin"]);
const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1500;
const MAX_CONVERSATION_LENGTH = 6000;

function validateMessages(messages) {
  if (
    !Array.isArray(messages) ||
    messages.length < 1 ||
    messages.length > MAX_MESSAGES
  ) {
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
      return res
        .status(403)
        .json({ message: "Your account role cannot use the assistant." });
    }

    const validationError = validateMessages(req.body?.messages);
    if (validationError)
      return res.status(400).json({ message: validationError });

    const userName =
      typeof req.body?.userName === "string" ? req.body.userName.trim() : "";
    const appContext =
      req.body?.appContext && typeof req.body.appContext === "object"
        ? req.body.appContext
        : null;

    const rawReply = await generateAssistantReply({
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
      role,
      userName,
      appContext,
      messages: req.body.messages.map(({ role: messageRole, text }) => ({
        role: messageRole,
        text: text.trim(),
      })),
    });

    const { cleanText, actions } = parseAssistantActions(rawReply);

    return res.json({ reply: cleanText, rawReply, actions });
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

async function draftComplaintDescription(req, res, next) {
  try {
    if (req.auth?.role !== "student") {
      return res
        .status(403)
        .json({ message: "Only students can draft complaint descriptions." });
    }
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const category =
      typeof req.body?.category === "string" ? req.body.category.trim() : "";
    if (title.length < 5 || title.length > 100) {
      return res
        .status(400)
        .json({
          message: "Enter a complaint title between 5 and 100 characters.",
        });
    }
    if (
      category &&
      ![
        "Electrical",
        "Plumbing",
        "Cleaning",
        "Internet",
        "Furniture",
        "Other",
      ].includes(category)
    ) {
      return res
        .status(400)
        .json({ message: "Choose a valid complaint category." });
    }

    const result = await generateComplaintDescriptionDraft({
      title,
      category,
      role: req.auth.role,
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

async function previewComplaintTriage(req, res, next) {
  try {
    if (req.auth?.role !== "student")
      return res
        .status(403)
        .json({ message: "Only students can preview complaint triage." });
    const input = {
      title: typeof req.body?.title === "string" ? req.body.title.trim() : "",
      description:
        typeof req.body?.description === "string"
          ? req.body.description.trim()
          : "",
      category:
        typeof req.body?.category === "string" ? req.body.category.trim() : "",
      building:
        typeof req.body?.building === "string" ? req.body.building.trim() : "",
    };
    if (
      input.title.length < 5 ||
      input.title.length > 100 ||
      input.description.length < 30 ||
      input.description.length > 2000
    ) {
      return res
        .status(400)
        .json({
          message:
            "Enter a title and at least 30 description characters to preview triage.",
        });
    }
    if (
      ![
        "Electrical",
        "Plumbing",
        "Cleaning",
        "Internet",
        "Furniture",
        "Other",
      ].includes(input.category)
    ) {
      return res
        .status(400)
        .json({ message: "Choose a valid complaint category." });
    }

    const triage = await triageComplaint(input);
    if (input.building) {
      const escapeRegex = (value) =>
        value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      triage.relatedOpenReports = await complaintModel.countDocuments({
        complaintTitle: new RegExp(`^${escapeRegex(input.title)}$`, "i"),
        category: input.category,
        "location.building": new RegExp(
          `^${escapeRegex(input.building)}$`,
          "i",
        ),
        status: {
          $in: [
            "Submitted",
            "Under_Review",
            "Assigned",
            "In_Progress",
            "On_Hold",
            "Reopened",
          ],
        },
        createdAt: { $gte: fromDate },
      });
    }
    triage.currentCategory = input.category;
    const token = jwt.sign(
      {
        purpose: "complaint-triage-preview",
        fingerprint: fingerprintComplaint(input),
        aiTriage: triage,
      },
      config.JWT_SECRET,
      { subject: String(req.auth.id), expiresIn: "15m" },
    );
    return res.json({ triage, token });
  } catch (error) {
    return next(error);
  }
}

async function voiceComplaintTurn(req, res, next) {
  try {
    if (req.auth?.role !== "student") {
      return res
        .status(403)
        .json({
          message: "Voice complaint creation is available to student accounts.",
        });
    }
    const utterance =
      typeof req.body?.utterance === "string" ? req.body.utterance.trim() : "";
    if (!utterance || utterance.length > 1200) {
      return res
        .status(400)
        .json({
          message: "Send a voice transcript of up to 1,200 characters.",
        });
    }
    const sourceDraft =
      req.body?.draft &&
      typeof req.body.draft === "object" &&
      !Array.isArray(req.body.draft)
        ? req.body.draft
        : {};
    const draft = {};
    for (const field of [
      "title",
      "description",
      "category",
      "building",
      "room",
    ]) {
      const value = sourceDraft[field];
      if (value !== undefined && typeof value !== "string") {
        return res
          .status(400)
          .json({ message: "Complaint draft fields must be text." });
      }
      draft[field] = value || "";
    }
    const result = await generateVoiceComplaintTurn({
      utterance,
      draft,
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AssistantServiceError)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function draftStatusNote(req, res, next) {
  try {
    if (req.auth?.role !== "staff")
      return res
        .status(403)
        .json({ message: "Only staff can draft complaint status notes." });
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const category =
      typeof req.body?.category === "string" ? req.body.category.trim() : "";
    const status = req.body?.status;
    if (
      title.length < 1 ||
      title.length > 100 ||
      !["Under_Review", "In_Progress", "On_Hold", "Resolved"].includes(status)
    ) {
      return res
        .status(400)
        .json({ message: "Provide a complaint title and a valid status." });
    }
    const result = await generateStatusNoteDraft({
      title,
      category,
      status,
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AssistantServiceError)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function reportInsights(req, res, next) {
  try {
    if (req.auth?.role !== "admin")
      return res
        .status(403)
        .json({ message: "Only administrators can request report insights." });
    const { period, summary, categories, statuses, departments } =
      req.body || {};
    if (
      !["Last 30 days", "Last 90 days", "Last 12 months", "All time"].includes(
        period,
      ) ||
      !summary ||
      typeof summary !== "object" ||
      !["total", "current", "resolved", "averageResolutionHours"].every(
        (key) => Number.isFinite(summary[key]) || summary[key] === null,
      ) ||
      ![categories, statuses, departments].every(
        (entries) =>
          Array.isArray(entries) &&
          entries.length <= 12 &&
          entries.every(
            (entry) =>
              typeof entry.label === "string" &&
              entry.label.length <= 40 &&
              Number.isInteger(entry.count) &&
              entry.count >= 0,
          ),
      )
    ) {
      return res
        .status(400)
        .json({ message: "Send valid aggregate report data to analyze." });
    }
    const result = await generateReportInsights({
      period,
      reportData: { summary, categories, statuses, departments },
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AssistantServiceError)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function diagnoseImage(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Upload an image of the broken equipment to diagnose." });
    }

    const diagnosis = await diagnoseComplaintImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
    });

    return res.json({ diagnosis });
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

async function formatStaffVoiceNote(req, res, next) {
  try {
    const role = req.auth?.role;
    if (role !== "staff" && role !== "admin") {
      return res.status(403).json({ message: "Only staff and administrators can format staff voice notes." });
    }

    const utterance = typeof req.body?.utterance === "string" ? req.body.utterance.trim() : "";
    if (!utterance) {
      return res.status(400).json({ message: "Send a spoken note to format." });
    }

    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "In_Progress";
    const complaintTitle = typeof req.body?.complaintTitle === "string" ? req.body.complaintTitle.trim() : "";

    const result = await formatStaffVoiceNoteService({
      utterance,
      status,
      complaintTitle,
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = {
  chat,
  draftComplaintDescription,
  previewComplaintTriage,
  voiceComplaintTurn,
  draftStatusNote,
  reportInsights,
  diagnoseImage,
  formatStaffVoiceNote,
  validateMessages,
};
