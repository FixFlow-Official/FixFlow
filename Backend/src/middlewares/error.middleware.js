const mongoose = require("mongoose");

const STATUS_TITLES = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

function notFoundHandler(req, res) {
  const status = 404;
  const title = STATUS_TITLES[status];
  const detail = "API route not found.";

  return res.status(status).json({
    type: "about:blank",
    title,
    status,
    detail,
    instance: req.originalUrl || req.path,
    message: detail,
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let status = error?.status || error?.statusCode || 500;
  let message = "An unexpected server error occurred.";

  // Safe request and persistence errors get stable, client-readable responses.
  if (error?.type === "entity.parse.failed") {
    status = 400;
    message = "Request body contains invalid JSON.";
  } else if (
    error?.type === "entity.too.large" ||
    error?.status === 413 ||
    error?.statusCode === 413 ||
    error?.code === "LIMIT_FILE_SIZE"
  ) {
    status = 413;
    message = "The uploaded request is too large.";
  } else if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    status = 400;
    message = "Request contains invalid data.";
  } else if (error?.code === 11000) {
    status = 409;
    message = "A record with these details already exists.";
  } else if (error?.name === "AssistantServiceError" || error?.expose || error?.isClientSafe || (status < 500 && error?.message)) {
    message = error.message;
  }

  // Keep implementation details in server logs only; never return them to clients.
  console.error("API request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error,
  });

  const title = STATUS_TITLES[status] || "Error";

  return res.status(status).json({
    type: "about:blank",
    title,
    status,
    detail: message,
    instance: req.originalUrl || req.path,
    message,
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler, STATUS_TITLES };
