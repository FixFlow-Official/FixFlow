const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const test = require("node:test");
const config = require("../src/config/config");
const sessionModel = require("../src/models/session.model");
const { verifySessionMiddleware, verifyAccessToken } = require("../src/middlewares/auth.middleware");
const { tokenRecreate } = require("../src/controllers/auth.controller");
const { REFRESH_ROTATION_GRACE_MS, REFRESH_TOKEN_TTL_MS } = require("../src/services/session.service");

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    cookies: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, val, options) {
      this.cookies[name] = { val, options };
      return this;
    },
  };
}

test("verifyAccessToken identifies expired access tokens and returns TOKEN_EXPIRED code", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "test-auth-secret";

  try {
    const expiredToken = jwt.sign(
      { id: "user-123", role: "student", sessionId: "sess-123" },
      config.JWT_SECRET,
      { expiresIn: "-1s" }, // Expired
    );

    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await verifyAccessToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, "TOKEN_EXPIRED");
    assert.equal(res.body.message, "Access token has expired.");
  } finally {
    config.JWT_SECRET = oldSecret;
  }
});

test("verifyAccessToken rejects invalid signatures with INVALID_TOKEN code", async () => {
  const req = { headers: { authorization: "Bearer invalid.jwt.signature" } };
  const res = createMockResponse();
  let nextCalled = false;

  await verifyAccessToken(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "INVALID_TOKEN");
  assert.equal(res.body.message, "Unauthorized");
});

test("verifySessionMiddleware accepts previous refresh token within grace period", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "test-auth-secret";

  try {
    const sessionId = "507f1f77bcf86cd799439099";
    const oldRefreshToken = jwt.sign(
      { tid: "token-v1", id: "user-456", role: "student", sessionId },
      config.JWT_SECRET,
      { expiresIn: "7d" },
    );
    const newRefreshToken = jwt.sign(
      { tid: "token-v2", id: "user-456", role: "student", sessionId },
      config.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const prevHash = await bcrypt.hash(oldRefreshToken, 4);
    const currHash = await bcrypt.hash(newRefreshToken, 4);

    const sessionInDb = {
      _id: sessionId,
      user: "user-456",
      userRef: "student",
      refreshTokenHash: currHash,
      previousRefreshTokenHash: prevHash,
      rotatedAt: new Date(Date.now() - 5000), // Rotated 5 seconds ago (inside 30s grace window)
      revoked: false,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    };

    const origFindOne = sessionModel.findOne;
    sessionModel.findOne = async () => sessionInDb;

    try {
      const req = { cookies: { refreshToken: oldRefreshToken } };
      const res = createMockResponse();
      let nextCalled = false;

      await verifySessionMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.isGraceToken, true);
      assert.equal(req.session, sessionInDb);
    } finally {
      sessionModel.findOne = origFindOne;
    }
  } finally {
    config.JWT_SECRET = oldSecret;
  }
});

test("verifySessionMiddleware rejects previous refresh token after grace period expires", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "test-auth-secret";

  try {
    const sessionId = "507f1f77bcf86cd799439099";
    const expiredToken = jwt.sign(
      { id: "user-456", role: "student", sessionId },
      config.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const prevHash = await bcrypt.hash(expiredToken, 4);
    const currHash = await bcrypt.hash("different-active-token", 4);

    const sessionInDb = {
      _id: sessionId,
      user: "user-456",
      userRef: "student",
      refreshTokenHash: currHash,
      previousRefreshTokenHash: prevHash,
      rotatedAt: new Date(Date.now() - (REFRESH_ROTATION_GRACE_MS + 1000)), // Beyond 30s
      revoked: false,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    };

    const origFindOne = sessionModel.findOne;
    sessionModel.findOne = async () => sessionInDb;

    try {
      const req = { cookies: { refreshToken: expiredToken } };
      const res = createMockResponse();
      let nextCalled = false;

      await verifySessionMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
    } finally {
      sessionModel.findOne = origFindOne;
    }
  } finally {
    config.JWT_SECRET = oldSecret;
  }
});

test("tokenRecreate returns fresh access token without re-rotation when grace token is presented", async () => {
  const oldSecret = config.JWT_SECRET;
  config.JWT_SECRET = "test-auth-secret";

  try {
    const targetSession = {
      _id: "507f1f77bcf86cd799439099",
      id: "507f1f77bcf86cd799439099",
      user: "user-456",
      userRef: "student",
      refreshTokenHash: "current-hash",
      previousRefreshTokenHash: "prev-hash",
      rotatedAt: new Date(),
    };

    const req = {
      decoded: { id: "user-456", role: "student" },
      session: targetSession,
      isGraceToken: true,
      cookies: {},
    };
    const res = createMockResponse();

    let findOneAndUpdateCalled = false;
    const origFindOneAndUpdate = sessionModel.findOneAndUpdate;
    sessionModel.findOneAndUpdate = async () => {
      findOneAndUpdateCalled = true;
      return targetSession;
    };

    try {
      await tokenRecreate(req, res, assert.fail);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.message, "Token refreshed successfully");
      assert.ok(typeof res.body.accessToken === "string");
      // Must not re-rotate or mutate database when resolving a grace-token request
      assert.equal(findOneAndUpdateCalled, false);
    } finally {
      sessionModel.findOneAndUpdate = origFindOneAndUpdate;
    }
  } finally {
    config.JWT_SECRET = oldSecret;
  }
});
