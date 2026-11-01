const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const test = require("node:test");
const config = require("../src/config/config");
const sessionModel = require("../src/models/session.model");
const { logoutMiddleware, verifyAccessToken } = require("../src/middlewares/auth.middleware");
const { loginController } = require("../src/controllers/auth.controller");
const {
  MAX_ACTIVE_SESSIONS,
  REFRESH_TOKEN_TTL_MS,
  enforceActiveSessionLimit,
  migrateSessionExpirations,
} = require("../src/services/session.service");

async function withStub(target, key, value, callback) {
  const original = target[key];
  target[key] = value;
  try {
    await callback();
  } finally {
    target[key] = original;
  }
}

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test("sessions have a TTL index and explicit expiry field", () => {
  const indexes = sessionModel.schema.indexes();
  assert.equal(sessionModel.schema.path("expiresAt").isRequired, true);
  assert.ok(indexes.some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test("legacy sessions receive an expiry based on their last update time", async () => {
  let captured;
  await withStub(sessionModel, "updateMany", async (...args) => { captured = args; }, async () => {
    await migrateSessionExpirations();
  });

  assert.deepEqual(captured[0], { expiresAt: { $exists: false } });
  assert.equal(captured[1][0].$set.expiresAt.$add[1], REFRESH_TOKEN_TTL_MS);
  assert.deepEqual(captured[1][0].$set.expiresAt.$add[0], {
    $ifNull: ["$updatedAt", "$createdAt"],
  });
});

test("new logins revoke older devices beyond the active-session cap", async () => {
  const now = Date.now();
  const sessions = Array.from({ length: MAX_ACTIVE_SESSIONS + 1 }, (_, index) => ({
    _id: `session-${index}`,
    createdAt: new Date(now - index * 1000),
  }));
  const operations = [];
  const query = {
    sort(sortValue) { operations.push(["sort", sortValue]); return this; },
    select(selectValue) { operations.push(["select", selectValue]); return this; },
    limit(limitValue) { operations.push(["limit", limitValue]); return this; },
    lean: async () => sessions,
  };

  await withStub(sessionModel, "find", (filter) => {
    operations.push(["find", filter]);
    return query;
  }, async () => {
    await withStub(sessionModel, "updateMany", async (...args) => {
      operations.push(["updateMany", ...args]);
    }, async () => {
      await enforceActiveSessionLimit({
        user: "user-id",
        userRef: "student",
        keepSessionId: "session-0",
      });
    });
  });

  const update = operations.find(([name]) => name === "updateMany");
  assert.deepEqual(update[1], { _id: { $in: ["session-5"] }, revoked: false });
  assert.equal(update[2].$set.revoked, true);
  assert.ok(update[2].$set.expiresAt instanceof Date);
  assert.equal(operations.find(([name]) => name === "limit")[1], MAX_ACTIVE_SESSIONS + 1);
});

test("refresh authentication directly loads the session from the token claim", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "session-test-secret";
  const sessionId = "507f1f77bcf86cd799439011";
  const refreshToken = jwt.sign(
    { id: "user-id", role: "student", sessionId },
    config.JWT_SECRET,
    { expiresIn: "7d" },
  );
  const refreshTokenHash = await bcrypt.hash(refreshToken, 4);
  const session = { _id: sessionId, refreshTokenHash };
  let lookup;
  const req = { cookies: { refreshToken } };
  const res = makeResponse();
  let nextCalled = false;

  try {
    await withStub(sessionModel, "findOne", async (filter) => {
      lookup = filter;
      return session;
    }, async () => {
      await withStub(sessionModel, "find", () => {
        throw new Error("New refresh tokens must not scan the user's sessions.");
      }, async () => {
        await logoutMiddleware(req, res, () => { nextCalled = true; });
      });
    });
  } finally {
    config.JWT_SECRET = oldSecret;
  }

  assert.equal(nextCalled, true);
  assert.equal(req.session, session);
  assert.equal(lookup._id, sessionId);
  assert.deepEqual(lookup.expiresAt.$gt instanceof Date, true);
});

test("refresh authentication forwards database failures instead of returning unauthorized", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "session-test-secret";
  const refreshToken = jwt.sign(
    { id: "user-id", role: "student", sessionId: "507f1f77bcf86cd799439011" },
    config.JWT_SECRET,
    { expiresIn: "7d" },
  );
  const databaseError = new Error("database unavailable");
  const req = { cookies: { refreshToken } };
  const res = makeResponse();
  let forwardedError;

  try {
    await withStub(sessionModel, "findOne", async () => { throw databaseError; }, async () => {
      await logoutMiddleware(req, res, (error) => { forwardedError = error; });
    });
  } finally {
    config.JWT_SECRET = oldSecret;
  }

  assert.equal(forwardedError, databaseError);
  assert.equal(res.statusCode, null);
});

test("access-token verification forwards session lookup failures to the error handler", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "session-test-secret";
  const accessToken = jwt.sign(
    { id: "user-id", role: "student", sessionId: "507f1f77bcf86cd799439011" },
    config.JWT_SECRET,
    { expiresIn: "15m" },
  );
  const databaseError = new Error("database unavailable");
  const req = { headers: { authorization: `Bearer ${accessToken}` } };
  const res = makeResponse();
  let forwardedError;

  try {
    await withStub(sessionModel, "findOne", async () => { throw databaseError; }, async () => {
      await verifyAccessToken(req, res, (error) => { forwardedError = error; });
    });
  } finally {
    config.JWT_SECRET = oldSecret;
  }

  assert.equal(forwardedError, databaseError);
  assert.equal(res.statusCode, null);
});

test("login creates a session-bound seven-day refresh token", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "session-test-secret";
  const passwordHash = await bcrypt.hash("correct-password", 4);
  const userId = "507f1f77bcf86cd799439012";
  const user = {
    _id: userId,
    id: userId,
    username: "Campus User",
    email: "user@example.edu",
    role: "student",
    rollno: 123,
    course: "BCA",
    password: passwordHash,
  };
  let createdSession;
  let refreshCookie;
  const req = {
    body: { email: user.email, password: "correct-password", type: "student" },
    model: { findOne: async () => user },
    ip: "127.0.0.1",
    headers: { "user-agent": "FixFlow session test" },
  };
  const res = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    cookie(name, value, options) { refreshCookie = { name, value, options }; },
  };
  const findQuery = {
    sort() { return this; },
    select() { return this; },
    limit() { return this; },
    lean: async () => [],
  };

  try {
    await withStub(sessionModel, "create", async (document) => {
      createdSession = document;
      return { ...document, id: String(document._id) };
    }, async () => {
      await withStub(sessionModel, "find", () => findQuery, async () => {
        await loginController(req, res);
      });
    });
  } finally {
    config.JWT_SECRET = oldSecret;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(refreshCookie.name, "refreshToken");
  assert.equal(createdSession.expiresAt.getTime() - Date.now() <= REFRESH_TOKEN_TTL_MS, true);
  const refreshClaims = jwt.decode(refreshCookie.value);
  assert.equal(refreshClaims.sessionId, String(createdSession._id));
  assert.equal(refreshClaims.exp - refreshClaims.iat, 7 * 24 * 60 * 60);
  assert.equal(jwt.decode(res.payload.accessToken).sessionId, String(createdSession._id));
});

