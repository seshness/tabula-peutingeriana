const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const SCOPES = 'user-read-playback-position user-library-read'

const KEYS = {
  ACCESS_TOKEN: 'tp_access_token',
  REFRESH_TOKEN: 'tp_refresh_token',
  EXPIRES_AT: 'tp_expires_at',
  CODE_VERIFIER: 'tp_code_verifier',
  STATE: 'tp_state',
}

function base64urlEncode(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return base64urlEncode(arr)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64urlEncode(new Uint8Array(digest))
}

export function getRedirectUri(): string {
  return window.location.origin + '/'
}

export async function startLogin(): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)))

  localStorage.setItem(KEYS.CODE_VERIFIER, verifier)
  localStorage.setItem(KEYS.STATE, state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleCallback(code: string, returnedState: string): Promise<boolean> {
  const expectedState = localStorage.getItem(KEYS.STATE)
  const verifier = localStorage.getItem(KEYS.CODE_VERIFIER)

  if (!verifier || returnedState !== expectedState) return false

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })

  if (!resp.ok) return false

  const data = await resp.json()
  storeTokens(data)
  localStorage.removeItem(KEYS.CODE_VERIFIER)
  localStorage.removeItem(KEYS.STATE)
  return true
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(KEYS.REFRESH_TOKEN)
  if (!refreshToken) return false

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })

  if (!resp.ok) return false

  const data = await resp.json()
  storeTokens(data)
  return true
}

function storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }): void {
  localStorage.setItem(KEYS.ACCESS_TOKEN, data.access_token)
  if (data.refresh_token) localStorage.setItem(KEYS.REFRESH_TOKEN, data.refresh_token)
  localStorage.setItem(KEYS.EXPIRES_AT, String(Date.now() + data.expires_in * 1000))
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.ACCESS_TOKEN)
}

export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(KEYS.EXPIRES_AT)
  if (!expiresAt) return true
  return Date.now() > Number(expiresAt) - 60_000
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(KEYS.ACCESS_TOKEN) && !!localStorage.getItem(KEYS.REFRESH_TOKEN)
}

export function logout(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
}
