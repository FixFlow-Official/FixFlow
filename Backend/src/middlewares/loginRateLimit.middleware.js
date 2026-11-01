const { rateLimit } = require("express-rate-limit");
const MongoRateLimitStore = require("./mongoRateLimitStore");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new MongoRateLimitStore("login"),
  message: {
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

module.exports = { loginLimiter };
