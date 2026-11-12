import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiRequestError,
  addComplaintCommentRequest,
  getComplaintDetailsRequest,
  getComplaintsRequest,
  getSimilarComplaintsRequest,
  upvoteComplaintRequest,
  loginRequest,
  getCurrentUserRequest,
  sendAssistantMessageRequest,
  diagnoseComplaintImageRequest,
  formatStaffVoiceNoteRequest,
  verifyComplaintResolutionRequest,
  rateComplaintRequest,
  reopenComplaintRequest,
  getAdminAuditQueueRequest,
  resolveAdminAuditRequest,
  getTrendingComplaintsRequest,
  getActiveBroadcastsRequest,
  getBroadcastMatchRequest,
  getAdminBroadcastsRequest,
  createBroadcastRequest,
  updateBroadcastRequest,
  deleteBroadcastRequest,
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

test("concurrent complaint requests deduplicate token refresh calls via mutex", async (t) => {
  const calls = [];
  mockFetch(t, async (url) => {
    calls.push(url);
    if (url === "/api/auth/token-recreate") {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return jsonResponse({ accessToken: "deduped-token" });
    }
    return jsonResponse({ complaints: [] });
  });

  const [res1, res2, res3] = await Promise.all([
    getComplaintsRequest(null),
    getComplaintsRequest(null),
    getComplaintsRequest(null),
  ]);

  assert.deepEqual(res1, { complaints: [] });
  assert.deepEqual(res2, { complaints: [] });
  assert.deepEqual(res3, { complaints: [] });

  const recreateCalls = calls.filter((url) => url === "/api/auth/token-recreate");
  assert.equal(recreateCalls.length, 1);
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

test("getSimilarComplaintsRequest serializes query parameters correctly", async (t) => {
  let request;
  mockFetch(t, async (url, options) => {
    request = { url, options };
    return jsonResponse({ complaints: [] });
  });

  const result = await getSimilarComplaintsRequest(
    {
      building: "PG Block",
      floor: "2nd Floor",
      room: "Room 204",
      category: "Plumbing",
    },
    "token-xyz",
  );

  assert.deepEqual(result, { complaints: [] });
  assert.equal(
    request.url,
    "/api/student/similar-complaints?building=PG+Block&floor=2nd+Floor&room=Room+204&category=Plumbing",
  );
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.Authorization, "Bearer token-xyz");
});

test("upvoteComplaintRequest posts to student upvote endpoint", async (t) => {
  let request;
  mockFetch(t, async (url, options) => {
    request = { url, options };
    return jsonResponse({ message: "Upvoted", upvoted: true, upvoteCount: 5 });
  });

  const result = await upvoteComplaintRequest("complaint-999", "token-xyz");

  assert.equal(result.upvoted, true);
  assert.equal(result.upvoteCount, 5);
  assert.equal(request.url, "/api/student/complaints/complaint-999/upvote");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer token-xyz");
});

test("ApiRequestError exposes status, requestId, and duplicate ticket metadata", () => {
  const err = new ApiRequestError("Duplicate issue found", {
    status: 409,
    requestId: "req-12345",
    errors: ["Matching active ticket exists"],
    isDuplicate: true,
    duplicateComplaint: { _id: "comp-dup-1" },
  });

  assert.equal(err.name, "ApiRequestError");
  assert.equal(err.message, "Duplicate issue found");
  assert.equal(err.status, 409);
  assert.equal(err.requestId, "req-12345");
  assert.deepEqual(err.errors, ["Matching active ticket exists"]);
  assert.equal(err.isDuplicate, true);
  assert.deepEqual(err.duplicateComplaint, { _id: "comp-dup-1" });
});

test("loginRequest sends credentials and parses response payload", async (t) => {
  let captured;
  mockFetch(t, async (url, options) => {
    captured = { url, options };
    return jsonResponse({ user: { id: "u1", role: "student" }, accessToken: "tok-1" });
  });

  const res = await loginRequest({ email: "user@example.com", password: "secretPassword", type: "student" });
  assert.equal(res.accessToken, "tok-1");
  assert.equal(captured.url, "/api/auth/login");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.credentials, "include");
});

test("loginRequest rejects with friendly message on server error or network dropout", async (t) => {
  mockFetch(t, async () => jsonResponse({ message: "Invalid credentials" }, 401));
  await assert.rejects(
    loginRequest({ email: "fail@example.com", password: "wrong", type: "student" }),
    /Invalid credentials/,
  );

  mockFetch(t, async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(
    loginRequest({ email: "fail@example.com", password: "wrong", type: "student" }),
    /Could not reach FixFlow\. Check that the backend is running\./,
  );
});

test("getCurrentUserRequest returns profile or handles network failure", async (t) => {
  mockFetch(t, async () => jsonResponse({ user: { id: "u2", username: "testuser" } }));
  const res = await getCurrentUserRequest();
  assert.equal(res.user.username, "testuser");

  mockFetch(t, async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(
    getCurrentUserRequest(),
    /Could not reach FixFlow\. Check that the backend is running\./,
  );
});

test("sendAssistantMessageRequest includes appContext and passes structured chat payload", async (t) => {
  let captured;
  mockFetch(t, async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return jsonResponse({
      reply: "Filtered electrical complaints for you.",
      actions: [{ type: "filter", params: { category: "Electrical" } }],
    });
  });

  const res = await sendAssistantMessageRequest(
    [{ role: "user", text: "Show electrical complaints" }],
    "token-abc",
    "Aarav",
    { currentSection: "student-complaints", activeFilters: { category: "all" } },
  );

  assert.equal(res.reply, "Filtered electrical complaints for you.");
  assert.equal(res.actions[0].type, "filter");
  assert.equal(captured.body.userName, "Aarav");
  assert.equal(captured.body.appContext.currentSection, "student-complaints");
});

test("diagnoseComplaintImageRequest posts image to /api/assistant/diagnose-image", async (t) => {
  let capturedUrl;
  let capturedMethod;
  mockFetch(t, async (url, options) => {
    capturedUrl = url;
    capturedMethod = options.method;
    return jsonResponse({
      diagnosis: {
        title: "Burnt Wall Socket",
        category: "Electrical",
        severity: "High",
        description: "Wall outlet is charred.",
      },
    });
  });

  const fakeFile = new Blob(["image data"], { type: "image/jpeg" });
  fakeFile.name = "broken_socket.jpg";

  const res = await diagnoseComplaintImageRequest(fakeFile, "token-xyz");
  assert.equal(res.diagnosis.title, "Burnt Wall Socket");
  assert.equal(res.diagnosis.severity, "High");
  assert.equal(capturedUrl, "/api/assistant/diagnose-image");
  assert.equal(capturedMethod, "POST");
});

test("formatStaffVoiceNoteRequest formats spoken technician notes", async (t) => {
  let capturedBody;
  mockFetch(t, async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return jsonResponse({
      formattedNote: "Replaced main valve. Water pressure tested and normal.",
    });
  });

  const res = await formatStaffVoiceNoteRequest(
    { utterance: "valve change kar diya paani check kiya", status: "In_Progress", complaintTitle: "Water leak" },
    "staff-token",
  );

  assert.equal(res.formattedNote, "Replaced main valve. Water pressure tested and normal.");
  assert.equal(capturedBody.utterance, "valve change kar diya paani check kiya");
  assert.equal(capturedBody.status, "In_Progress");
});

test("verifyComplaintResolutionRequest submits rating and verification feedback", async (t) => {
  let capturedUrl;
  let capturedBody;
  mockFetch(t, async (url, options) => {
    capturedUrl = url;
    capturedBody = JSON.parse(options.body);
    return jsonResponse({
      message: "Complaint resolution verified successfully.",
      complaint: { _id: "c123", resolutionVerified: true, csatRating: 5 },
    });
  });

  const res = await verifyComplaintResolutionRequest(
    "c123",
    { rating: 5, feedback: "Work is done nicely!" },
    "student-jwt",
  );

  assert.equal(capturedUrl, "/api/student/complaints/c123/verify-resolution");
  assert.equal(capturedBody.rating, 5);
  assert.equal(capturedBody.feedback, "Work is done nicely!");
  assert.equal(res.complaint.resolutionVerified, true);
});

test("reopenComplaintRequest submits reopen reason and updates complaint status", async (t) => {
  let capturedUrl;
  let capturedMethod;
  mockFetch(t, async (url, options) => {
    capturedUrl = url;
    capturedMethod = options.method;
    return jsonResponse({
      message: "Complaint has been reopened for maintenance staff.",
      complaint: { _id: "c123", status: "In_Progress", reopenedCount: 1 },
    });
  });

  const res = await reopenComplaintRequest(
    "c123",
    { reason: "Tap is still leaking from the base.", imageFile: null },
    "student-jwt",
  );

  assert.equal(capturedUrl, "/api/student/complaints/c123/reopen");
  assert.equal(capturedMethod, "POST");
  assert.equal(res.complaint.reopenedCount, 1);
});

test("rateComplaintRequest posts CSAT rating and feedback to /api/student/complaints/:id/csat", async (t) => {
  let capturedUrl;
  let capturedMethod;
  let capturedBody;
  mockFetch(t, async (url, options) => {
    capturedUrl = url;
    capturedMethod = options.method;
    capturedBody = JSON.parse(options.body);
    return jsonResponse({
      message: "Thank you for your feedback.",
      complaint: { _id: "c123", csatRating: 5, csatFeedback: "Excellent fix!" },
    });
  });

  const res = await rateComplaintRequest(
    "c123",
    { rating: 5, feedback: "Excellent fix!" },
    "student-jwt",
  );

  assert.equal(capturedUrl, "/api/student/complaints/c123/csat");
  assert.equal(capturedMethod, "POST");
  assert.equal(capturedBody.rating, 5);
  assert.equal(capturedBody.feedback, "Excellent fix!");
  assert.equal(res.complaint.csatRating, 5);
});

test("getAdminAuditQueueRequest and resolveAdminAuditRequest call admin audit endpoints", async (t) => {
  let calls = [];
  mockFetch(t, async (url, options) => {
    calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    if (options.method === "GET") {
      return jsonResponse({ complaints: [{ _id: "c123", adminAuditRequired: true }] });
    }
    return jsonResponse({ message: "Audit resolved.", complaint: { _id: "c123", adminAuditRequired: false } });
  });

  const queueRes = await getAdminAuditQueueRequest("admin-jwt");
  assert.equal(calls[0].url, "/api/admin/audit-queue");
  assert.equal(calls[0].method, "GET");
  assert.equal(queueRes.complaints.length, 1);

  const resolveRes = await resolveAdminAuditRequest("c123", "Inspected and verified.", "admin-jwt");
  assert.equal(calls[1].url, "/api/admin/complaints/c123/audit");
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].body.note, "Inspected and verified.");
  assert.equal(resolveRes.complaint.adminAuditRequired, false);
});

test("getTrendingComplaintsRequest fetches active campus complaints sorted by votes", async (t) => {
  let capturedUrl;
  mockFetch(t, async (url) => {
    capturedUrl = url;
    return jsonResponse({
      complaints: [
        { _id: "c1", complaintTitle: "Wi-Fi down", upvoteCount: 12, hasUpvoted: true },
      ],
      total: 1,
    });
  });

  const res = await getTrendingComplaintsRequest(
    { category: "Internet", search: "Wi-Fi" },
    "student-token",
  );

  assert.match(capturedUrl, /\/api\/student\/trending-complaints\?category=Internet&search=Wi-Fi/);
  assert.equal(res.total, 1);
  assert.equal(res.complaints[0].upvoteCount, 12);
  assert.equal(res.complaints[0].hasUpvoted, true);
});

test("broadcastRequests send correct URLs, methods, and payloads", async (t) => {
  const calls = [];
  mockFetch(t, async (url, options) => {
    calls.push({
      url,
      method: options?.method || "GET",
      body: options?.body ? JSON.parse(options.body) : null,
      headers: options?.headers,
    });
    return jsonResponse({ success: true, broadcasts: [], matched: true, match: { title: "Wi-Fi Outage" } });
  });

  // 1. getActiveBroadcastsRequest
  await getActiveBroadcastsRequest("token-1");
  assert.equal(calls[0].url, "/api/broadcasts/active");
  assert.equal(calls[0].method, "GET");

  // 2. getBroadcastMatchRequest
  await getBroadcastMatchRequest({ category: "Internet", building: "Central Library" }, "token-1");
  assert.match(calls[1].url, /\/api\/broadcasts\/match\?category=Internet&building=Central\+Library/);
  assert.equal(calls[1].method, "GET");

  // 3. createBroadcastRequest
  const newBroadcast = {
    title: "Power cut",
    message: "Transformer issue",
    category: "Electrical",
    startsAt: "2026-11-12T10:00:00Z",
    endsAt: "2026-11-12T14:00:00Z",
  };
  await createBroadcastRequest(newBroadcast, "admin-token");
  assert.equal(calls[2].url, "/api/admin/broadcasts");
  assert.equal(calls[2].method, "POST");
  assert.equal(calls[2].body.title, "Power cut");

  // 4. updateBroadcastRequest
  await updateBroadcastRequest("b123", { isActive: false }, "admin-token");
  assert.equal(calls[3].url, "/api/admin/broadcasts/b123");
  assert.equal(calls[3].method, "PATCH");
  assert.equal(calls[3].body.isActive, false);

  // 5. deleteBroadcastRequest
  await deleteBroadcastRequest("b123", "admin-token");
  assert.equal(calls[4].url, "/api/admin/broadcasts/b123");
  assert.equal(calls[4].method, "DELETE");
});




