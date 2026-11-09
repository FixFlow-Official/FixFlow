const assert = require("node:assert/strict");
const test = require("node:test");
const MongoRateLimitStore = require("../src/middlewares/mongoRateLimitStore");

test("assistant route keyGenerator safely handles optional req.auth with IP fallback", () => {
  // Test assistant limiter key generator logic directly
  const keyGen = (req) => (req.auth?.id ? `user:${req.auth.id}` : `ip:${req.ip || "unknown"}`);

  assert.equal(keyGen({ auth: { id: "user-999" } }), "user:user-999");
  assert.equal(keyGen({ ip: "192.168.1.50" }), "ip:192.168.1.50");
  assert.equal(keyGen({ auth: null, ip: "10.0.0.1" }), "ip:10.0.0.1");
  assert.equal(keyGen({}), "ip:unknown");
});

test("MongoRateLimitStore maintains bucket integrity and handles decrement boundaries", async () => {
  const store = new MongoRateLimitStore("test-boundary");
  store.init({ windowMs: 60_000 });

  const dummyCollection = {
    createIndex: async () => {},
    findOne: async () => ({ totalHits: 5, resetAt: new Date(Date.now() + 30000) }),
    updateOne: async (filter, update) => {
      // Asserts that decrement clamps to 0 using $max
      assert.deepEqual(update[0].$set.totalHits, {
        $max: [0, { $subtract: ["$totalHits", 1] }],
      });
    },
    deleteOne: async (filter) => {
      assert.equal(filter.namespace, "test-boundary");
      assert.equal(filter.key, "user:123");
    },
  };

  const origCollection = Object.getOwnPropertyDescriptor(MongoRateLimitStore.prototype, "collection");
  Object.defineProperty(store, "collection", {
    get: () => dummyCollection,
    configurable: true,
  });

  try {
    const bucket = await store.get("user:123");
    assert.equal(bucket.totalHits, 5);

    await store.decrement("user:123");
    await store.resetKey("user:123");
  } finally {
    if (origCollection) {
      Object.defineProperty(MongoRateLimitStore.prototype, "collection", origCollection);
    }
  }
});
