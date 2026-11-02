const assert = require("node:assert/strict");
const test = require("node:test");
const config = require("../src/config/config");
const securityHeaders = require("../src/middlewares/securityHeaders.middleware");

function applyHeaders() {
  const headers = {};
  let nextCalled = false;
  securityHeaders({}, {
    setHeader(name, value) { headers[name] = value; },
  }, () => { nextCalled = true; });
  return { headers, nextCalled };
}

test("sets security and non-cache headers on API responses", () => {
  const { headers, nextCalled } = applyHeaders();
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["X-DNS-Prefetch-Control"], "off");
  assert.equal(headers["X-Permitted-Cross-Domain-Policies"], "none");
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(nextCalled, true);
});

test("adds HSTS only for production responses", () => {
  const originalEnvironment = config.NODE_ENV;
  try {
    config.NODE_ENV = "development";
    assert.equal(applyHeaders().headers["Strict-Transport-Security"], undefined);
    config.NODE_ENV = "production";
    assert.equal(applyHeaders().headers["Strict-Transport-Security"], "max-age=15552000");
  } finally {
    config.NODE_ENV = originalEnvironment;
  }
});
