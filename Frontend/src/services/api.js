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


export async function verifyEmailRequest({ otp, id, type }) {
  let response

  try {
    response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp, id, type }),
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