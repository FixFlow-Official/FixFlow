const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const { uploadSingleImage } = require("../middlewares/multer.middleware");
const MongoRateLimitStore = require("../middlewares/mongoRateLimitStore");
const assistantController = require("../controllers/assistant.controller");

const router = express.Router();
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  keyGenerator: (req) =>
    req.auth?.id ? `user:${req.auth.id}` : `ip:${ipKeyGenerator(req.ip || "127.0.0.1")}`,
  validate: { ip: false },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new MongoRateLimitStore("assistant"),
  message: {
    message: "You have sent several assistant messages. Please wait a minute and try again.",
  },
});

router.post("/chat", verifyAccessToken, assistantLimiter, assistantController.chat);
router.post("/complaint-description", verifyAccessToken, assistantLimiter, assistantController.draftComplaintDescription);
router.post("/complaint-triage", verifyAccessToken, assistantLimiter, assistantController.previewComplaintTriage);
router.post("/voice-complaint-turn", verifyAccessToken, assistantLimiter, assistantController.voiceComplaintTurn);
router.post("/status-note", verifyAccessToken, assistantLimiter, assistantController.draftStatusNote);
router.post("/report-insights", verifyAccessToken, assistantLimiter, assistantController.reportInsights);
router.post("/diagnose-image", verifyAccessToken, uploadSingleImage("image"), assistantLimiter, assistantController.diagnoseImage);
router.post("/format-staff-voice-note", verifyAccessToken, assistantLimiter, assistantController.formatStaffVoiceNote);

module.exports = router;
