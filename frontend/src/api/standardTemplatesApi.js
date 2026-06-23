import { apiGet, apiPost, apiPut } from './apiClient'

/**
 * @param {{ accessToken?: string | null, signal?: AbortSignal, q?: string }} [options]
 */
export async function fetchStandardTemplatesList({ signal, q } = {}) {
  const params = new URLSearchParams()
  if (typeof q === 'string' && q.trim()) params.set('q', q.trim())
  const qs = params.toString()
  const path = qs ? `/api/standard-templates?${qs}` : '/api/standard-templates'
  return apiGet(path, { signal })
}

/**
 * @param {object} payload
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function createStandardTemplate(payload, { signal } = {}) {
  return apiPost('/api/standard-templates', payload, { signal })
}

/**
 * @param {string} id
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchStandardTemplateById(id, { signal } = {}) {
  const safeId = encodeURIComponent(String(id || '').trim())
  return apiGet(`/api/standard-templates/${safeId}`, { signal })
}

/**
 * @param {string} id
 * @param {object} payload
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function updateStandardTemplate(id, payload, { signal } = {}) {
  const safeId = encodeURIComponent(String(id || '').trim())
  return apiPut(`/api/standard-templates/${safeId}`, payload, { signal })
}
