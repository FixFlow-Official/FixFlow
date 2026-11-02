import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiRequestError,
  addComplaintCommentRequest,
  getComplaintDetailsRequest,
  getComplaintsRequest,
} from "../src/services/api.js";

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function mockFetch(t, implementation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = originalFetch; });
}

test("complaint list requests serialize filters and send the current access token", async (t) => {
  let request;
  mockFetch(t, async (url, options) => {
    request = { url, options };
    return jsonResponse({ complaints: [] });
  });

  const result = await getComplaintsRequest("access-token", {
    view: "resolved",
    page: 2,
    search: "water leak",
    blank: "",
    missing: null,
  });

  assert.deepEqual(result, { complaints: [] });
  assert.equal(request.url, "/api/student/get-complaint?view=resolved&page=2&search=water+leak");
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.credentials, "include");
  assert.equal(request.options.headers.Authorization, "Bearer access-token");
});

test("complaint requests refresh an expired access token and retry once", async (t) => {
  const calls = [];
  mockFetch(t, async (url, options) => {
    calls.push({ url, authorization: options?.headers?.Authorization });
    if (url === "/api/auth/token-recreate") {
      return jsonResponse({ accessToken: "fresh-token" });
    }
    if (options.headers.Authorization === "Bearer old-token") {
      return jsonResponse({ message: "Expired" }, 401);
    }
    return jsonResponse({ complaint: { _id: "complaint-1" } });
  });

  const result = await getComplaintDetailsRequest("complaint/1", "old-token");

  assert.deepEqual(result, { complaint: { _id: "complaint-1" } });
  assert.deepEqual(calls.map(({ url }) => url), [
    "/api/complaints/complaint%2F1",
    "/api/auth/token-recreate",
    "/api/complaints/complaint%2F1",
  ]);
  const complaintCalls = calls.filter(({ url }) => url.startsWith("/api/complaints/"));
  assert.deepEqual(complaintCalls.map(({ authorization }) => authorization), [
    "Bearer old-token",
    "Bearer fresh-token",
  ]);
});

test("complaint requests obtain a token from the refresh cookie when none is supplied", async (t) => {
  const calls = [];
  mockFetch(t, async (url) => {
    calls.push(url);
    return url === "/api/auth/token-recreate"
      ? jsonResponse({ accessToken: "cookie-token" })
      : jsonResponse({ complaints: [] });
  });

  const result = await getComplaintsRequest(null);

  assert.deepEqual(result, { complaints: [] });
  assert.deepEqual(calls, ["/api/auth/token-recreate", "/api/student/get-complaint"]);
});

test("complaint requests expose validation messages and support request IDs", async (t) => {
  mockFetch(t, async () => jsonResponse({
    message: "Request validation failed.",
    requestId: "server-request-123",
    errors: [{ field: "location.room", message: "Room is required." }],
  }, 400));

  await assert.rejects(
    addComplaintCommentRequest("complaint-1", "Please check this", "token"),
    (error) => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.status, 400);
      assert.equal(error.requestId, "server-request-123");
      assert.match(error.message, /Location Room: Room is required/);
      return true;
    },
  );
});

test("complaint requests include request IDs from response headers when the body omits them", async (t) => {
  mockFetch(t, async () => jsonResponse(
    { message: "Not authorized." },
    403,
    { "X-Request-ID": "header-request-456" },
  ));

  await assert.rejects(
    getComplaintDetailsRequest("complaint-1", "token"),
    (error) => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.requestId, "header-request-456");
      assert.match(error.message, /Support reference: header-request-456/);
      return true;
    },
  );
});

test("complaint requests report offline connection failures with a readable message", async (t) => {
  mockFetch(t, async () => { throw new TypeError("Network unavailable"); });

  await assert.rejects(
    getComplaintsRequest("token"),
    /Could not reach FixFlow\. Check that the backend is running\./,
  );
});
