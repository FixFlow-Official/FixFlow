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
    throw new Error(data.message || "The complaint request failed.");
  }

  return data;
}

export async function getComplaintsRequest(accessToken) {
  return complaintRequest(
    "/api/student/get-complaint",
    { method: "GET" },
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

export async function getUnassignedComplaintsRequest(accessToken) {
  return complaintRequest(
    "/api/admin/complaints/unassigned",
    { method: "GET" },
    accessToken,
  );
}

export async function getAssignedComplaintsRequest(accessToken) {
  return complaintRequest(
    "/api/admin/complaints/assigned",
    { method: "GET" },
    accessToken,
  );
}

export async function getStaffAssignedComplaintsRequest(accessToken) {
  return complaintRequest(
    "/api/staff/assigned-complaints",
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
