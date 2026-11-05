const assert = require("node:assert/strict");
const test = require("node:test");
const { validateConfig } = require("../src/config/config");

function validConfig(overrides = {}) {
  return {
    NODE_ENV: "production",
    HOST: "0.0.0.0",
    PORT: 3000,
    TRUST_PROXY_HOPS: 0,
    MONGO_URI: "mongodb+srv://example.test/fixflow",
    JWT_SECRET: "a-secure-secret-that-is-at-least-32-characters-long",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_REFRESH_TOKEN: "refresh-token",
    GOOGLE_USER: "support@example.edu",
    IMAGEKIT_PRIVATE_KEY: "imagekit-key",
    GEMINI_API_KEY: undefined,
    GEMINI_MODEL: "gemini-3.5-flash-lite",
    VAPID_PUBLIC_KEY: undefined,
    VAPID_PRIVATE_KEY: undefined,
    ...overrides,
  };
}

test("accepts complete production configuration and optional push keys", () => {
  assert.equal(validateConfig(validConfig()).PORT, 3000);
  assert.equal(validateConfig(validConfig({ TRUST_PROXY_HOPS: 1 })).TRUST_PROXY_HOPS, 1);
  assert.equal(
    validateConfig(validConfig({ VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private" }))
      .VAPID_PUBLIC_KEY,
    "public",
  );
});

test("reports missing required variables without exposing their values", () => {
  assert.throws(
    () => validateConfig(validConfig({ GOOGLE_REFRESH_TOKEN: " " })),
    /GOOGLE_REFRESH_TOKEN/,
  );
});

test("rejects invalid port, database URI, production secret, and partial VAPID keys", () => {
  assert.throws(() => validateConfig(validConfig({ PORT: 70000 })), /PORT/);
  assert.throws(() => validateConfig(validConfig({ TRUST_PROXY_HOPS: -1 })), /TRUST_PROXY_HOPS/);
  assert.throws(() => validateConfig(validConfig({ TRUST_PROXY_HOPS: 1.5 })), /TRUST_PROXY_HOPS/);
  assert.throws(() => validateConfig(validConfig({ MONGO_URI: "https://db.example" })), /MONGO_URI/);
  assert.throws(() => validateConfig(validConfig({ JWT_SECRET: "short" })), /JWT_SECRET/);
  assert.throws(
    () => validateConfig(validConfig({ VAPID_PUBLIC_KEY: "public" })),
    /both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY/,
  );
  assert.throws(
    () => validateConfig(validConfig({ VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private", VAPID_SUBJECT: "invalid-subject" })),
    /VAPID_SUBJECT/,
  );
});
