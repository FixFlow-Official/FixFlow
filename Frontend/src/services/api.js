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

export async function logoutRequest(accessToken) {
  let token = accessToken;

  if (!token) {
    let refreshResponse;

    try {
      refreshResponse = await fetch("/api/auth/token-recreate", {
        method: "GET",
        credentials: "include",
      });
    } catch {
      throw new Error(
        "Could not reach FixFlow. Check that the backend is running.",
      );
    }

    const refreshData = await refreshResponse.json().catch(() => ({}));

    if (!refreshResponse.ok) {
      throw new Error(
        refreshData.message ||
          "Your session has expired. Please sign in again.",
      );
    }

    token = refreshData.accessToken;
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
    let refreshResponse;

    try {
      refreshResponse = await fetch("/api/auth/token-recreate", {
        method: "GET",
        credentials: "include",
      });
    } catch {
      throw new Error(
        "Could not reach FixFlow. Check that the backend is running.",
      );
    }

    const refreshData = await refreshResponse.json().catch(() => ({}));

    if (!refreshResponse.ok) {
      throw new Error(
        refreshData.message ||
          "Your session has expired. Please sign in again.",
      );
    }

    token = refreshData.accessToken;
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
    const validationMessage = Array.isArray(data.error)
      ? data.error.map((item) => item.msg).filter(Boolean).join(" ")
      : "";
    throw new Error(
      data.message ||
        validationMessage ||
        `Request failed with status ${response.status}.`,
    );
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
  { title, description, category, building, room, image },
  accessToken,
) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  formData.append("category", category);
  formData.append("building", building);
  formData.append("room", room);
  formData.append("complaintImage", image);

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
