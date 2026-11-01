const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { body } = require("express-validator");
const test = require("node:test");
const { errorHandler, notFoundHandler } = require("../src/middlewares/error.middleware");
const {
  requestIdMiddleware,
  structuredRequestLog,
} = require("../src/middlewares/requestId.middleware");
const { validateResult } = require("../src/middlewares/validator.middleware");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("returns validation failures in a predictable message/errors shape", async () => {
  const req = { body: { email: "not-an-email" }, requestId: "request-123" };
  const res = createResponse();
  let advanced = false;

  await body("email").isEmail().withMessage("Enter a valid email.").run(req);
  validateResult(req, res, () => { advanced = true; });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    message: "Request validation failed.",
    requestId: "request-123",
    errors: [{ field: "email", message: "Enter a valid email.", location: "body" }],
  });
  assert.equal(advanced, false);
});

test("maps malformed JSON and duplicate database keys to safe API errors", () => {
  const req = { method: "POST", originalUrl: "/api/users", path: "/api/users", requestId: "request-123" };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const malformedJson = createResponse();
    errorHandler({ type: "entity.parse.failed" }, req, malformedJson, assert.fail);
    assert.equal(malformedJson.statusCode, 400);
    assert.deepEqual(malformedJson.body, {
      message: "Request body contains invalid JSON.",
      requestId: "request-123",
    });

    const duplicate = createResponse();
    errorHandler({ code: 11000, message: "private database detail" }, req, duplicate, assert.fail);
    assert.equal(duplicate.statusCode, 409);
    assert.deepEqual(duplicate.body, {
      message: "A record with these details already exists.",
      requestId: "request-123",
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("hides unexpected error details and provides JSON for unknown API paths", () => {
  const req = { method: "GET", originalUrl: "/api/private", path: "/api/private", requestId: "request-456" };
  const originalConsoleError = console.error;
  let loggedContext;
  console.error = (_message, context) => { loggedContext = context; };

  try {
    const res = createResponse();
    errorHandler(new Error("secret database connection string"), req, res, assert.fail);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      message: "An unexpected server error occurred.",
      requestId: "request-456",
    });
    assert.equal(JSON.stringify(res.body).includes("secret"), false);
    assert.equal(loggedContext.requestId, "request-456");

    const notFound = createResponse();
    notFoundHandler(req, notFound);
    assert.equal(notFound.statusCode, 404);
    assert.deepEqual(notFound.body, {
      message: "API route not found.",
      requestId: "request-456",
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("maps oversized uploads and Mongoose validation errors", () => {
  const req = { method: "POST", originalUrl: "/api/complaints", path: "/api/complaints", requestId: "request-789" };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const oversized = createResponse();
    errorHandler({ code: "LIMIT_FILE_SIZE" }, req, oversized, assert.fail);
    assert.equal(oversized.statusCode, 413);

    const validation = createResponse();
    errorHandler(new mongoose.Error.ValidationError(), req, validation, assert.fail);
    assert.equal(validation.statusCode, 400);
    assert.deepEqual(validation.body, {
      message: "Request contains invalid data.",
      requestId: "request-789",
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("assigns a server-generated request ID and writes it in structured logs", () => {
  const req = { method: "POST", path: "/api/complaints" };
  const headers = {};
  const res = { setHeader(name, value) { headers[name] = value; } };
  let nextCalled = false;

  requestIdMiddleware(req, res, () => { nextCalled = true; });

  assert.match(req.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(headers["X-Request-ID"], req.requestId);
  assert.equal(nextCalled, true);

  const log = JSON.parse(structuredRequestLog({
    method: () => "POST",
    status: () => "500",
    "response-time": () => "12.5",
  }, req, { statusCode: 500 }));
  assert.equal(log.requestId, req.requestId);
  assert.equal(log.method, "POST");
  assert.equal(log.path, "/api/complaints");
  assert.equal(log.status, 500);
  assert.equal(log.durationMs, 12.5);
});
