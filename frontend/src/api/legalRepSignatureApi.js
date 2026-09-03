import appConfig from '../../config.js'
import { acquireApiAccessToken } from '../auth/msalToken'
import { apiDelete } from './apiClient'

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

/**
 * @param {string} companyId
 * @param {1|2} repIndex
 * @param {File} file
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function uploadLegalRepSignature(companyId, repIndex, file, { signal } = {}) {
  const accessToken = await acquireApiAccessToken()
  if (!accessToken) {
    return { ok: false, status: 401, message: 'No autorizado. Inicie sesión nuevamente.' }
  }

  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const formData = new FormData()
  formData.append('signature', file)

  const res = await fetch(`${baseUrl}/api/companies/${companyId}/legal-rep-signatures/${repIndex}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
    signal,
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : body && typeof body === 'object' && typeof body.message === 'string'
          ? body.message
          : 'No se pudo subir la firma.'
    return { ok: false, status: res.status, message }
  }

  const data = body && typeof body === 'object' ? body.data : null
  return { ok: true, status: res.status, data }
}

/**
 * @param {string} companyId
 * @param {1|2} repIndex
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function deleteLegalRepSignature(companyId, repIndex, { signal } = {}) {
  return apiDelete(`/api/companies/${companyId}/legal-rep-signatures/${repIndex}`, { signal })
}
