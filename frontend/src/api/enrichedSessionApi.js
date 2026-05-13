/**
 * @typedef {{ code: string, label: string }} AppProfile
 */

/**
 * @param {string} apiBaseUrl
 * @param {string} accessToken
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ ok: boolean, status: number, body: unknown }>}
 */
export async function fetchEnrichedSession(apiBaseUrl, accessToken, options = {}) {
  const { signal } = options
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/me/session`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    signal
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}
