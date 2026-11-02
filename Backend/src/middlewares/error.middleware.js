const mongoose = require("mongoose");

function notFoundHandler(req, res) {
  return res.status(404).json({
    message: "API route not found.",
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let status = 500;
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
  }

  // Keep implementation details in server logs only; never return them to clients.
  console.error("API request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error,
  });

  return res.status(status).json({
    message,
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
