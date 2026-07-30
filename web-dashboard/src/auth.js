const API_BASE = '/api/v1'
const ACCESS_TOKEN_KEY = 'hogfarm_access_token'

export function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export async function apiRequest(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = data?.detail || response.statusText || 'Request failed'
    throw new Error(message)
  }

  return response.json().catch(() => null)
}

export async function loginUser(email, password) {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = data?.detail || response.statusText || 'Login failed'
    throw new Error(message)
  }

  return response.json()
}

export async function registerUser(payload) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = data?.detail || response.statusText || 'Registration failed'
    throw new Error(message)
  }

  return response.json()
}
