const assert = require("node:assert/strict");
const test = require("node:test");
const connectDB = require("../src/config/database");

test("database startup retries connection and runs migration before becoming ready", async () => {
  let connectAttempts = 0;
  let migrationCalls = 0;
  const delays = [];
  const mongooseClient = {
    connection: { readyState: 0 },
    async connect() {
      connectAttempts += 1;
      if (connectAttempts === 1) throw new Error("temporary connection failure");
      this.connection.readyState = 1;
    },
  };

  await connectDB({
    mongooseClient,
    migrate: async () => { migrationCalls += 1; },
    wait: async (delayMs) => { delays.push(delayMs); },
  });

  assert.equal(connectAttempts, 2);
  assert.equal(migrationCalls, 1);
  assert.deepEqual(delays, [1000]);
});

test("database startup retries a failed directory migration without reconnecting", async () => {
  let connectAttempts = 0;
  let migrationCalls = 0;
  const mongooseClient = {
    connection: { readyState: 0 },
    async connect() {
      connectAttempts += 1;
      this.connection.readyState = 1;
    },
  };

  await connectDB({
    mongooseClient,
    migrate: async () => {
      migrationCalls += 1;
      if (migrationCalls === 1) throw new Error("temporary migration failure");
    },
    wait: async () => {},
  });

  assert.equal(connectAttempts, 1);
  assert.equal(migrationCalls, 2);
});

test("database startup stops retrying when shutdown aborts the pending wait", async () => {
  const controller = new AbortController();
  let connectAttempts = 0;
  const mongooseClient = {
    connection: { readyState: 0 },
    async connect() {
      connectAttempts += 1;
      throw new Error("database unavailable");
    },
  };

  await connectDB({
    signal: controller.signal,
    mongooseClient,
    migrate: async () => {},
    wait: async (_delayMs, signal) => {
      controller.abort();
      throw signal.reason;
    },
  });

  assert.equal(connectAttempts, 1);
});
