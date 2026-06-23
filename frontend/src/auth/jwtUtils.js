/**
 * @param {string} accessToken
 * @returns {{ sub?: string, email?: string, preferred_username?: string } | null}
 */
export function parseJwtPayload(accessToken) {
  try {
    const part = accessToken.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

/**
 * @param {string} accessToken
 * @param {string} [fallbackEmail]
 * @returns {{ id: string, email: string } | null}
 */
export function userFromAccessToken(accessToken, fallbackEmail = '') {
  const payload = parseJwtPayload(accessToken)
  const id = typeof payload?.sub === 'string' ? payload.sub : null
  if (!id) return null
  const email =
    (typeof payload?.email === 'string' && payload.email) ||
    (typeof payload?.preferred_username === 'string' && payload.preferred_username) ||
    fallbackEmail ||
    ''
  return { id, email }
}

/**
 * @param {{ access_token: string, refresh_token: string, expires_in: number }} tokenResponse
 * @param {string} [loginEmail]
 */
export function buildSessionFromTokenResponse(tokenResponse, loginEmail = '') {
  const expiresAt = Date.now() + (Number(tokenResponse.expires_in) || 0) * 1000
  const accessToken = tokenResponse.access_token
  const refreshToken = tokenResponse.refresh_token
  const user = userFromAccessToken(accessToken, loginEmail)
  return {
    accessToken,
    refreshToken,
    expiresAt,
    user
  }
}
