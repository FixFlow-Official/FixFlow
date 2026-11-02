const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const test = require("node:test");
const { loginController } = require("../src/controllers/auth.controller");
const MongoRateLimitStore = require("../src/middlewares/mongoRateLimitStore");

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

test("login rate-limit store scopes counters to its namespace and handles atomic increments", async () => {
  const store = new MongoRateLimitStore("login");
  const calls = [];
  const bucket = { totalHits: 1, resetAt: new Date(Date.now() + 60_000) };
  Object.defineProperty(store, "collection", {
    value: {
      async createIndex(...args) { calls.push(["createIndex", ...args]); },
      async findOneAndUpdate(...args) {
        calls.push(["findOneAndUpdate", ...args]);
        return { value: bucket };
      },
    },
  });

  store.init({ windowMs: 900_000 });
  const first = await store.increment("127.0.0.1");
  const second = await store.increment("127.0.0.1");

  assert.deepEqual(first, { totalHits: 1, resetTime: bucket.resetAt });
  assert.deepEqual(second, first);
  const updateCall = calls.find(([name]) => name === "findOneAndUpdate");
  assert.deepEqual(updateCall[1], { namespace: "login", key: "127.0.0.1" });
  assert.ok(Array.isArray(updateCall[2]), "counter update must be an aggregation pipeline");
  assert.equal(updateCall[3].upsert, true);
  assert.equal(updateCall[3].returnDocument, "after");
  assert.equal(calls.filter(([name]) => name === "createIndex").length, 2);
});
