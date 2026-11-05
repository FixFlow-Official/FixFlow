const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const MongoRateLimitStore = require("../middlewares/mongoRateLimitStore");
const assistantController = require("../controllers/assistant.controller");

const router = express.Router();
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  keyGenerator: (req) => `user:${req.auth.id}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new MongoRateLimitStore("assistant"),
  message: {
    message: "You have sent several assistant messages. Please wait a minute and try again.",
  },
});

router.post("/chat", verifyAccessToken, assistantLimiter, assistantController.chat);

module.exports = router;
