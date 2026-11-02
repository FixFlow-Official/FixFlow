const config = require("../config/config");

/** Apply response protections to API and health-check responses. */
function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cache-Control", "no-store");

  // Browsers only honor HSTS over HTTPS; enable it for production responses.
  if (config.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
  }

  return next();
}

module.exports = securityHeaders;
