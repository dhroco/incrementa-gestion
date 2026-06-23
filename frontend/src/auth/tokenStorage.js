const ACCESS_TOKEN_KEY = 'incrementa.access_token'
const REFRESH_TOKEN_KEY = 'incrementa.refresh_token'
const EXPIRES_AT_KEY = 'incrementa.expires_at'

/**
 * @returns {{ accessToken: string, refreshToken: string, expiresAt: number } | null}
 */
export function loadStoredTokens() {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    const expiresRaw = localStorage.getItem(EXPIRES_AT_KEY)
    const expiresAt = expiresRaw ? Number(expiresRaw) : NaN
    if (!accessToken || !refreshToken || !Number.isFinite(expiresAt)) return null
    return { accessToken, refreshToken, expiresAt }
  } catch {
    return null
  }
}

/**
 * @param {{ accessToken: string, refreshToken: string, expiresAt: number }} tokens
 */
export function saveStoredTokens(tokens) {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    localStorage.setItem(EXPIRES_AT_KEY, String(tokens.expiresAt))
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredTokens() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(EXPIRES_AT_KEY)
  } catch {
    // ignore
  }
}
