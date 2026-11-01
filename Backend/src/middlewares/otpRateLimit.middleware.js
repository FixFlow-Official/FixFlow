const { rateLimit } = require("express-rate-limit");
const MongoRateLimitStore = require("./mongoRateLimitStore");

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new MongoRateLimitStore("otp-request"),
  message: {
    message: "Too many code requests. Please try again in 15 minutes.",
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new MongoRateLimitStore("otp-verify"),
  message: {
    message: "Too many verification attempts. Please try again in 15 minutes.",
  },
});

module.exports = { otpRequestLimiter, otpVerifyLimiter };
