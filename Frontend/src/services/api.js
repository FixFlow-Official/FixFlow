export async function loginRequest({ email, password, type }) {
  let response

  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, type }),
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Sign-in failed. Please try again.')
  }

  return data
}

export async function getCurrentUserRequest() {
  let response

  try {
    response = await fetch('/api/auth/getMe', {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not get the signed-in user.')
  }

  return data
}

export async function logoutRequest(accessToken) {
  let token = accessToken

  if (!token) {
    let refreshResponse

    try {
      refreshResponse = await fetch('/api/auth/token-recreate', {
        method: 'GET',
        credentials: 'include',
      })
    } catch {
      throw new Error('Could not reach FixFlow. Check that the backend is running.')
    }

    const refreshData = await refreshResponse.json().catch(() => ({}))

    if (!refreshResponse.ok) {
      throw new Error(refreshData.message || 'Your session has expired. Please sign in again.')
    }

    token = refreshData.accessToken
  }

  let response

  try {
    response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not sign out.')
  }

  return data
}

export async function logoutAllRequest(accessToken) {
  let token = accessToken

  if (!token) {
    let refreshResponse

    try {
      refreshResponse = await fetch('/api/auth/token-recreate', {
        method: 'GET',
        credentials: 'include',
      })
    } catch {
      throw new Error('Could not reach FixFlow. Check that the backend is running.')
    }

    const refreshData = await refreshResponse.json().catch(() => ({}))

    if (!refreshResponse.ok) {
      throw new Error(
        refreshData.message || 'Your session has expired. Please sign in again.',
      )
    }

    token = refreshData.accessToken
  }

  let response

  try {
    response = await fetch('/api/auth/logoutAll', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not sign out from all devices.')
  }

  return data
}

export async function verifyUserRequest({ id, type }) {
  let response

  try {
    response = await fetch('/api/auth/verify-user', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, type }),
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not verify this campus ID.')
  }

  return data
}


export async function requestPasswordResetCode({ id, type }) {
  let response

  try {
    response = await fetch('/api/auth/verify-user-for-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, type }),
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not send a password reset code.')
  }

  return data
}

export async function verifyEmailRequest({
  otp,
  id,
  type,
  purpose = 'registration',
}) {
  let response

  try {
    response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp, id, type, purpose }),
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not verify this code.')
  }

  return data
}


export async function resetPasswordRequest({ password, id, type }) {
  let response

  try {
    response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, id, type }),
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not reset your password.')
  }

  return data
}

export async function createAccountRequest({ password, type }) {
  let response

  try {
    response = await fetch('/api/auth/create-user', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, type }),
    })
  } catch {
    throw new Error('Could not reach FixFlow. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Could not create your account.')
  }

  return data
}