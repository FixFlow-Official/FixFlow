const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { body } = require("express-validator");
const test = require("node:test");
const { errorHandler, notFoundHandler } = require("../src/middlewares/error.middleware");
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
  const req = { body: { email: "not-an-email" } };
  const res = createResponse();
  let advanced = false;

  await body("email").isEmail().withMessage("Enter a valid email.").run(req);
  validateResult(req, res, () => { advanced = true; });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    message: "Request validation failed.",
    errors: [{ field: "email", message: "Enter a valid email.", location: "body" }],
  });
  assert.equal(advanced, false);
});

test("maps malformed JSON and duplicate database keys to safe API errors", () => {
  const req = { method: "POST", originalUrl: "/api/users" };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const malformedJson = createResponse();
    errorHandler({ type: "entity.parse.failed" }, req, malformedJson, assert.fail);
    assert.equal(malformedJson.statusCode, 400);
    assert.deepEqual(malformedJson.body, { message: "Request body contains invalid JSON." });

    const duplicate = createResponse();
    errorHandler({ code: 11000, message: "private database detail" }, req, duplicate, assert.fail);
    assert.equal(duplicate.statusCode, 409);
    assert.deepEqual(duplicate.body, { message: "A record with these details already exists." });
  } finally {
    console.error = originalConsoleError;
  }
});

test("hides unexpected error details and provides JSON for unknown API paths", () => {
  const req = { method: "GET", originalUrl: "/api/private" };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const res = createResponse();
    errorHandler(new Error("secret database connection string"), req, res, assert.fail);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: "An unexpected server error occurred." });
    assert.equal(JSON.stringify(res.body).includes("secret"), false);

    const notFound = createResponse();
    notFoundHandler(req, notFound);
    assert.equal(notFound.statusCode, 404);
    assert.deepEqual(notFound.body, { message: "API route not found." });
  } finally {
    console.error = originalConsoleError;
  }
});

test("maps oversized uploads and Mongoose validation errors", () => {
  const req = { method: "POST", originalUrl: "/api/complaints" };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const oversized = createResponse();
    errorHandler({ code: "LIMIT_FILE_SIZE" }, req, oversized, assert.fail);
    assert.equal(oversized.statusCode, 413);

    const validation = createResponse();
    errorHandler(new mongoose.Error.ValidationError(), req, validation, assert.fail);
    assert.equal(validation.statusCode, 400);
    assert.deepEqual(validation.body, { message: "Request contains invalid data." });
  } finally {
    console.error = originalConsoleError;
  }
});
