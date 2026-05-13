import { apiGet, apiPost, apiPut } from './apiClient'

function companyHeaders(companyId) {
  const id = typeof companyId === 'string' ? companyId.trim() : ''
  return id.length > 0 ? { 'X-Company-Id': id } : {}
}

/**
 * @param {{ accessToken?: string | null, signal?: AbortSignal, q?: string, companyId: string }} options
 */
export async function fetchCompanyTemplatesList({ accessToken, signal, q, companyId } = {}) {
  const params = new URLSearchParams()
  if (typeof q === 'string' && q.trim()) params.set('q', q.trim())
  const qs = params.toString()
  const path = qs ? `/api/company-templates?${qs}` : '/api/company-templates'
  return apiGet(path, { accessToken, signal, headers: companyHeaders(companyId) })
}

/**
 * @param {object} payload
 * @param {{ accessToken?: string | null, signal?: AbortSignal, companyId: string }} options
 */
export async function createCompanyTemplate(payload, { accessToken, signal, companyId } = {}) {
  return apiPost('/api/company-templates', payload, { accessToken, signal, headers: companyHeaders(companyId) })
}

/**
 * @param {string} id
 * @param {{ accessToken?: string | null, signal?: AbortSignal, companyId: string }} options
 */
export async function fetchCompanyTemplateById(id, { accessToken, signal, companyId } = {}) {
  const safeId = encodeURIComponent(String(id || '').trim())
  return apiGet(`/api/company-templates/${safeId}`, { accessToken, signal, headers: companyHeaders(companyId) })
}

/**
 * @param {string} id
 * @param {object} payload
 * @param {{ accessToken?: string | null, signal?: AbortSignal, companyId: string }} options
 */
export async function updateCompanyTemplate(id, payload, { accessToken, signal, companyId } = {}) {
  const safeId = encodeURIComponent(String(id || '').trim())
  return apiPut(`/api/company-templates/${safeId}`, payload, { accessToken, signal, headers: companyHeaders(companyId) })
}
