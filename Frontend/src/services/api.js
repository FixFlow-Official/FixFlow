/**
 * API errors keep structured server details while exposing a readable message
 * to existing page-level error banners.
 */
export class ApiRequestError extends Error {
  constructor(
    message,
    { status = null, requestId = null, errors = [], isDuplicate = false, duplicateComplaint = null } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.requestId = requestId;
    this.errors = errors;
    this.isDuplicate = isDuplicate;
    this.duplicateComplaint = duplicateComplaint;
  }
}

export async function loginRequest({ email, password, type }) {
  let response;

  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, type }),
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Sign-in failed. Please try again.");
  }

  return data;
}

export async function getCurrentUserRequest() {
  let response;

  try {
    response = await fetch("/api/auth/getMe", {
      method: "GET",
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not get the signed-in user.");
  }

  return data;
}

export async function sendAssistantMessageRequest(messages, accessToken, userName) {
  return complaintRequest(
    "/api/assistant/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, userName }),
    },
    accessToken,
  );
}

export async function sendVoiceComplaintTurnRequest({ utterance, draft }, accessToken) {
  return complaintRequest(
    "/api/assistant/voice-complaint-turn",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utterance, draft }),
    },
    accessToken,
  );
}

export async function suggestComplaintDescriptionRequest({ title, category }, accessToken) {
  return complaintRequest(
    "/api/assistant/complaint-description",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category }),
    },
    accessToken,
  );
}

export async function previewComplaintTriageRequest({ title, description, category, building }, accessToken) {
  return complaintRequest(
    "/api/assistant/complaint-triage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, building }),
    },
    accessToken,
  );
}

export async function suggestStatusNoteRequest({ title, category, status }, accessToken) {
  return complaintRequest("/api/assistant/status-note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, category, status }),
  }, accessToken);
}

export async function getAdminReportInsightsRequest(reportData, accessToken) {
  return complaintRequest("/api/assistant/report-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reportData),
  }, accessToken);
}

export async function updateMyProfileRequest(
  { username, profilePicture, removeProfilePicture = false },
  accessToken,
) {
  const formData = new FormData();
  formData.append("username", username);
  if (profilePicture) formData.append("profilePicture", profilePicture);
  if (removeProfilePicture) formData.append("removeProfilePicture", "true");
  return complaintRequest("/api/auth/profile", { method: "PATCH", body: formData }, accessToken);
}

export async function changeMyPasswordRequest(
  { currentPassword, newPassword },
  accessToken,
) {
  return complaintRequest(
    "/api/auth/change-password",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    accessToken,
  );
}

let inFlightRefreshPromise = null;

export async function refreshAccessTokenRequest() {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    let response;

    try {
      response = await fetch("/api/auth/token-recreate", {
        method: "GET",
        credentials: "include",
      });
    } catch {
      throw new Error(
        "Could not reach FixFlow. Check that the backend is running.",
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.accessToken) {
      throw new Error(
        data.message || "Your session has expired. Please sign in again.",
      );
    }

    return data.accessToken;
  })().finally(() => {
    inFlightRefreshPromise = null;
  });

  return inFlightRefreshPromise;
}

export async function logoutRequest(accessToken) {
  let token = accessToken;

  if (!token) {
    token = await refreshAccessTokenRequest();
  }

  let response;

  try {
    response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not sign out.");
  }

  return data;
}

export async function logoutAllRequest(accessToken) {
  let token = accessToken;

  if (!token) {
    token = await refreshAccessTokenRequest();
  }

  let response;

  try {
    response = await fetch("/api/auth/logoutAll", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not sign out from all devices.");
  }

  return data;
}

export async function verifyUserRequest({ id, type }) {
  let response;

  try {
    response = await fetch("/api/auth/verify-user", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, type }),
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Could not verify this campus ID.");
    error.retryAfterSeconds = data.retryAfterSeconds;
    throw error;
  }

  return data;
}

export async function requestPasswordResetCode({ id, type }) {
  let response;

  try {
    response = await fetch("/api/auth/verify-user-for-password", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, type }),
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || "Could not send a password reset code.",
    );
    error.retryAfterSeconds = data.retryAfterSeconds;
    throw error;
  }

  return data;
}

export async function verifyEmailRequest({
  otp,
  id,
  type,
  purpose = "registration",
}) {
  let response;

  try {
    response = await fetch("/api/auth/verify-email", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp, id, type, purpose }),
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not verify this code.");
  }

  return data;
}

export async function resetPasswordRequest({ password, id, type }) {
  let response;

  try {
    response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, id, type }),
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not reset your password.");
  }

  return data;
}

export async function createAccountRequest({ password, type, termsAccepted }) {
  let response;

  try {
    response = await fetch("/api/auth/create-user", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, type, termsAccepted }),
    });
  } catch {
    throw new Error(
      "Could not reach FixFlow. Check that the backend is running.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not create your account.");
  }

  return data;
}

async function getComplaintAccessToken(accessToken) {
  if (accessToken) {
    return accessToken;
  }

  return refreshAccessTokenRequest();
}

async function complaintRequest(url, options, accessToken) {
  let token = await getComplaintAccessToken(accessToken);

  async function sendRequest(currentToken) {
    try {
      return await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          ...options.headers,
          Authorization: `Bearer ${currentToken}`,
        },
      });
    } catch {
      throw new Error(
        "Could not reach FixFlow. Check that the backend is running.",
      );
    }
  }

  let response = await sendRequest(token);

  // If the access token expired, refresh it and retry once.
  if (response.status === 401) {
    token = await getComplaintAccessToken(null);
    response = await sendRequest(token);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // express-validator returns `errors`; accept the older `error` shape too.
    const validationErrors = Array.isArray(data.errors)
      ? data.errors
      : Array.isArray(data.error)
        ? data.error.map((item) => ({
            field: item.path || item.param || "request",
            message: item.message || item.msg,
          }))
        : [];

    const validationDetails = validationErrors
      .map(({ field, message }) => {
        if (!message) return "";
        const readableField = String(field || "request")
          .split(/[._]/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
        return `${readableField}: ${message}`;
      })
      .filter(Boolean)
      .join(" ");

    const baseMessage = [data.message, validationDetails]
      .filter(Boolean)
      .join(" ");
    const requestId =
      data.requestId || response.headers.get("X-Request-ID") || null;
    const message = [
      baseMessage || `Request failed with status ${response.status}.`,
      requestId ? `Support reference: ${requestId}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    throw new ApiRequestError(message, {
      status: response.status,
      requestId,
      errors: validationErrors,
      isDuplicate: Boolean(data.isDuplicate),
      duplicateComplaint: data.duplicateComplaint || null,
    });
  }

  return data;
}

function buildComplaintQuery(options = {}) {
  const query = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function getComplaintsRequest(accessToken, options = {}) {
  return complaintRequest(
    `/api/student/get-complaint${buildComplaintQuery(options)}`,
    { method: "GET" },
    accessToken,
  );
}

export async function getComplaintCommentsRequest(complaintId, accessToken) {
  return complaintRequest(
    `/api/complaints/${encodeURIComponent(complaintId)}/comments`,
    { method: "GET" },
    accessToken,
  );
}

export async function getComplaintDetailsRequest(complaintId, accessToken) {
  return complaintRequest(
    `/api/complaints/${encodeURIComponent(complaintId)}`,
    { method: "GET" },
    accessToken,
  );
}

export async function addComplaintCommentRequest(complaintId, message, accessToken) {
  return complaintRequest(
    `/api/complaints/${encodeURIComponent(complaintId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
    accessToken,
  );
}

export async function getNotificationsRequest(accessToken) {
  return complaintRequest("/api/notifications", { method: "GET" }, accessToken);
}

export async function markNotificationReadRequest(notificationId, accessToken) {
  return complaintRequest(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
    accessToken,
  );
}

export async function markAllNotificationsReadRequest(accessToken) {
  return complaintRequest(
    "/api/notifications/read-all",
    { method: "PATCH" },
    accessToken,
  );
}

export async function getPushConfigRequest(accessToken) {
  return complaintRequest("/api/notifications/push-config", { method: "GET" }, accessToken);
}

export async function savePushSubscriptionRequest(subscription, accessToken) {
  return complaintRequest(
    "/api/notifications/push-subscription",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    },
    accessToken,
  );
}

export async function removePushSubscriptionRequest(endpoint, accessToken) {
  return complaintRequest(
    "/api/notifications/push-subscription",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    },
    accessToken,
  );
}

export async function createComplaintRequest(
  {
    title,
    description,
    category,
    building,
    floor,
    room,
    image,
    triageToken,
    confirmedCampusIssue,
    confirmDistinctIssue,
  },
  accessToken,
) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  formData.append("category", category);
  formData.append("building", building);
  if (floor) formData.append("floor", floor);
  formData.append("room", room);
  formData.append("complaintImage", image);
  if (triageToken) formData.append("triageToken", triageToken);
  if (confirmedCampusIssue) formData.append("confirmedCampusIssue", "true");
  if (confirmDistinctIssue) formData.append("confirmDistinctIssue", "true");

  return complaintRequest(
    "/api/student/create-complaint",
    {
      method: "POST",
      body: formData,
    },
    accessToken,
  );
}

export async function getUnassignedComplaintsRequest(accessToken, options = {}) {
  return complaintRequest(
    `/api/admin/complaints/unassigned${buildComplaintQuery(options)}`,
    { method: "GET" },
    accessToken,
  );
}

export async function getAssignedComplaintsRequest(accessToken, options = {}) {
  return complaintRequest(
    `/api/admin/complaints/assigned${buildComplaintQuery(options)}`,
    { method: "GET" },
    accessToken,
  );
}

export async function getAdminComplaintReportsRequest(period, accessToken) {
  const query = new URLSearchParams({ period });
  return complaintRequest(
    `/api/admin/reports/complaints?${query.toString()}`,
    { method: "GET" },
    accessToken,
  );
}

export async function getAdminSlaOverviewRequest({ page = 1, limit = 20, view = "all" } = {}, accessToken) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), view });
  return complaintRequest(`/api/admin/sla?${query.toString()}`, { method: "GET" }, accessToken);
}

export async function updateAdminSlaPoliciesRequest(policies, accessToken) {
  return complaintRequest(
    "/api/admin/sla/policies",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policies }),
    },
    accessToken,
  );
}

export async function getAdminComplaintSlaHistoryRequest(complaintId, accessToken) {
  return complaintRequest(
    `/api/admin/sla/complaints/${encodeURIComponent(complaintId)}/history`,
    { method: "GET" },
    accessToken,
  );
}

export async function getStaffAssignedComplaintsRequest(accessToken, options = {}) {
  return complaintRequest(
    `/api/staff/assigned-complaints${buildComplaintQuery(options)}`,
    { method: "GET" },
    accessToken,
  );
}

export async function getStaffByDepartmentRequest(department, accessToken) {
  const query = new URLSearchParams({ department });

  return complaintRequest(
    `/api/admin/staff?${query.toString()}`,
    { method: "GET" },
    accessToken,
  );
}

export async function getRegisteredAccountsRequest(accessToken, options = {}) {
  const query = new URLSearchParams({
    type: options.type || "student",
    page: String(options.page || 1),
    limit: String(options.limit || 20),
  });
  if (options.search?.trim()) query.set("search", options.search.trim());

  return complaintRequest(
    `/api/admin/accounts?${query.toString()}`,
    { method: "GET" },
    accessToken,
  );
}

export async function resetAccountPasswordByAdminRequest(
  { accountId, type, newPassword },
  accessToken,
) {
  return complaintRequest(
    `/api/admin/accounts/${encodeURIComponent(accountId)}/password`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, newPassword }),
    },
    accessToken,
  );
}

export async function assignComplaintRequest(
  { complaintId, staffId, department },
  accessToken,
) {
  return complaintRequest(
    `/api/admin/complaints/${encodeURIComponent(complaintId)}/assign`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffId, department }),
    },
    accessToken,
  );
}

export async function reassignComplaintRequest(
  { complaintId, staffId, department },
  accessToken,
) {
  return complaintRequest(
    `/api/admin/complaints/${encodeURIComponent(complaintId)}/reassign`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffId, department }),
    },
    accessToken,
  );
}

// Remove a student or staff member from the campus directory and, if registered,
// delete the account and revoke its sessions through the admin endpoint.
export async function deleteUserByAdminRequest({ id, type }, accessToken) {
  return complaintRequest(
    "/api/admin/delete-user-by-admin",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, type }),
    },
    accessToken,
  );
}

// Add an approved person to the campus directory. They still register via email OTP.
export async function addUserToDirectoryByAdminRequest(
  { id, name, email, course, type },
  accessToken,
) {
  return complaintRequest(
    "/api/admin/directory/users",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        name,
        email,
        course,
        type,
      }),
    },
    accessToken,
  );
}

export async function updateComplaintStatusRequest(
  { complaintId, status, note = "", resolutionProof = null },
  accessToken,
) {
  const formData = new FormData();
  formData.append("status", status);
  formData.append("note", note);

  if (resolutionProof) {
    formData.append("resolutionProof", resolutionProof);
  }

  return complaintRequest(
    `/api/staff/complaints/${encodeURIComponent(complaintId)}/status`,
    {
      method: "PATCH",
      body: formData,
    },
    accessToken,
  );
}

// Campus Layout & Spatial GIS API
export async function getCampusBlocksRequest(accessToken) {
  return complaintRequest("/api/campus/blocks", { method: "GET" }, accessToken);
}

export async function getCampusHeatmapRequest(accessToken) {
  return complaintRequest("/api/campus/heatmap", { method: "GET" }, accessToken);
}

export async function createCampusBlockRequest(blockData, accessToken) {
  return complaintRequest(
    "/api/campus/blocks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockData),
    },
    accessToken,
  );
}

export async function updateCampusBlockRequest(id, blockData, accessToken) {
  return complaintRequest(
    `/api/campus/blocks/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockData),
    },
    accessToken,
  );
}

export async function deleteCampusBlockRequest(id, accessToken) {
  return complaintRequest(
    `/api/campus/blocks/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    accessToken,
  );
}

export async function initKarnalPresetRequest(accessToken) {
  return complaintRequest("/api/campus/preset-karnal", { method: "POST" }, accessToken);
}

// Student Duplicate Detection & "Me Too" Upvoting API
export async function getSimilarComplaintsRequest(
  { building, floor, room, category, title, description } = {},
  accessToken,
) {
  const query = new URLSearchParams();
  if (building) query.set("building", building);
  if (floor) query.set("floor", floor);
  if (room) query.set("room", room);
  if (category) query.set("category", category);
  if (title) query.set("title", title);
  if (description) query.set("description", description);

  return complaintRequest(
    `/api/student/similar-complaints?${query.toString()}`,
    { method: "GET" },
    accessToken,
  );
}

export async function upvoteComplaintRequest(complaintId, accessToken) {
  return complaintRequest(
    `/api/student/complaints/${encodeURIComponent(complaintId)}/upvote`,
    { method: "POST" },
    accessToken,
  );
}


