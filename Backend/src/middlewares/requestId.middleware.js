const { randomUUID } = require("node:crypto");

function requestIdMiddleware(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  return next();
}

function structuredRequestLog(tokens, req, res) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: tokens.method(req, res),
    path: req.path,
    status: Number(tokens.status(req, res)),
    durationMs: Number(tokens["response-time"](req, res)),
  });
}

module.exports = { requestIdMiddleware, structuredRequestLog };
