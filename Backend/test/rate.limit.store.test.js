const assert = require("node:assert/strict");
const test = require("node:test");
const MongoRateLimitStore = require("../src/middlewares/mongoRateLimitStore");

function useCollection(store, collection) {
  Object.defineProperty(store, "collection", { value: collection });
}

test("increments counters atomically and creates shared indexes once", async () => {
  const store = new MongoRateLimitStore("otp-request");
  const calls = [];
  const resetAt = new Date(Date.now() + 15 * 60 * 1000);
  useCollection(store, {
    async createIndex(...args) { calls.push(["createIndex", ...args]); },
    async findOneAndUpdate(...args) {
      calls.push(["findOneAndUpdate", ...args]);
      return { value: { totalHits: 4, resetAt } };
    },
  });
  store.init({ windowMs: 900_000 });

  const first = await store.increment("192.0.2.20");
  const second = await store.increment("192.0.2.20");
  const updates = calls.filter(([name]) => name === "findOneAndUpdate");

  assert.deepEqual(first, { totalHits: 4, resetTime: resetAt });
  assert.deepEqual(second, first);
  assert.equal(calls.filter(([name]) => name === "createIndex").length, 2);
  assert.deepEqual(updates[0][1], { namespace: "otp-request", key: "192.0.2.20" });
  assert.ok(Array.isArray(updates[0][2]), "updates use MongoDB aggregation pipeline syntax");
  assert.equal(updates[0][3].upsert, true);
  assert.equal(updates[0][3].returnDocument, "after");
});

test("retries the atomic increment once when concurrent upserts collide", async () => {
  const store = new MongoRateLimitStore("login");
  const calls = [];
  const duplicateKeyError = Object.assign(new Error("duplicate key"), { code: 11000 });
  const resetAt = new Date(Date.now() + 60_000);
  useCollection(store, {
    async createIndex() {},
    async findOneAndUpdate(...args) {
      calls.push(args);
      if (calls.length === 1) throw duplicateKeyError;
      return { totalHits: 2, resetAt };
    },
  });
  store.init({ windowMs: 60_000 });

  const bucket = await store.increment("192.0.2.21");

  assert.deepEqual(bucket, { totalHits: 2, resetTime: resetAt });
  assert.equal(calls.length, 2);
  assert.ok(Array.isArray(calls[0][1]));
  assert.equal(calls[0][2].upsert, true);
  assert.equal(calls[1][2].upsert, undefined);
});

test("reads an active bucket and scopes deletion to the store namespace", async () => {
  const store = new MongoRateLimitStore("otp-verify");
  const resetAt = new Date(Date.now() + 60_000);
  const calls = [];
  useCollection(store, {
    async createIndex() {},
    async findOne(query) {
      calls.push(["findOne", query]);
      return { totalHits: 3, resetAt };
    },
    async deleteOne(query) {
      calls.push(["deleteOne", query]);
    },
  });
  store.init({ windowMs: 60_000 });

  assert.deepEqual(await store.get("192.0.2.22"), { totalHits: 3, resetTime: resetAt });
  await store.resetKey("192.0.2.22");

  assert.equal(calls[0][1].namespace, "otp-verify");
  assert.equal(calls[0][1].key, "192.0.2.22");
  assert.ok(calls[0][1].resetAt.$gt instanceof Date);
  assert.deepEqual(calls[1][1], { namespace: "otp-verify", key: "192.0.2.22" });
});

test("fails closed when MongoDB is unavailable", async () => {
  const store = new MongoRateLimitStore("login");
  store.init({ windowMs: 60_000 });

  await assert.rejects(store.increment("192.0.2.23"), /MongoDB is not connected/);
});
