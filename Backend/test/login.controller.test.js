const assert = require("node:assert/strict");
const { once } = require("node:events");
const bcrypt = require("bcrypt");
const express = require("express");
const test = require("node:test");
const { loginController } = require("../src/controllers/auth.controller");
const studentModel = require("../src/models/student.model");
const authRouter = require("../src/routes/auth.routes");

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("unknown email and incorrect password return the same login failure", async () => {
  const passwordHash = await bcrypt.hash("correct-password", 4);

  const unknownEmailResponse = makeResponse();
  await loginController(
    {
      body: {
        email: "unknown@example.edu",
        password: "incorrect-password",
        type: "student",
      },
      model: { findOne: async () => null },
    },
    unknownEmailResponse,
  );

  const incorrectPasswordResponse = makeResponse();
  await loginController(
    {
      body: {
        email: "known@example.edu",
        password: "incorrect-password",
        type: "student",
      },
      model: {
        findOne: async () => ({ password: passwordHash }),
      },
    },
    incorrectPasswordResponse,
  );

  assert.equal(unknownEmailResponse.statusCode, 401);
  assert.equal(incorrectPasswordResponse.statusCode, 401);
  assert.deepEqual(unknownEmailResponse.payload, {
    message: "Invalid email or password.",
  });
  assert.deepEqual(
    incorrectPasswordResponse.payload,
    unknownEmailResponse.payload,
  );
});

test("login endpoint limits repeated attempts from one IP", async (t) => {
  const originalFindOne = studentModel.findOne;
  studentModel.findOne = async () => null;

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    studentModel.findOne = originalFindOne;
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "unknown@example.edu",
        password: "incorrect-password",
        type: "student",
      }),
    });
    assert.equal(response.status, 401);
  }

  const limitedResponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "unknown@example.edu",
      password: "incorrect-password",
      type: "student",
    }),
  });

  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(await limitedResponse.json(), {
    message: "Too many login attempts. Please try again in 15 minutes.",
  });
});
