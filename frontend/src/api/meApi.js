import appConfig from '../../config.js'
import { acquireApiAccessToken } from '../auth/msalToken'

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

/**
 * @param {{ contact_email?: string, widget_preferences?: object }} payload
 * @param {{ signal?: AbortSignal }} options
 */
export async function updateMyProfile(payload, { signal } = {}) {
  const accessToken = await acquireApiAccessToken()
  if (!accessToken) {
    return { ok: false, status: 401, message: 'No autorizado. Inicie sesión nuevamente.' }
  }
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const res = await fetch(`${baseUrl}/api/me/profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload ?? {}),
    signal
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : body && typeof body === 'object' && typeof body.message === 'string'
          ? body.message
          : 'No se pudo actualizar el perfil.'
    return { ok: false, status: res.status, message }
  }
  return { ok: true, status: res.status, body }
}

/**
 * @param {File} file
 * @param {{ signal?: AbortSignal }} options
 */
export async function uploadMyAvatar(file, { signal } = {}) {
  const accessToken = await acquireApiAccessToken()
  if (!accessToken) {
    return { ok: false, status: 401, message: 'No autorizado. Inicie sesión nuevamente.' }
  }
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const formData = new FormData()
  formData.append('avatar', file)

  const res = await fetch(`${baseUrl}/api/me/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData,
    signal
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : body && typeof body === 'object' && typeof body.message === 'string'
          ? body.message
          : 'No se pudo subir la imagen.'
    return { ok: false, status: res.status, message }
  }
  return { ok: true, status: res.status, body }
}
