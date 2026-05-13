import { apiGet, apiPost, apiPut } from './apiClient'

/**
 * @param {{ q?: string, accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchUniversalClausesList({ q = '', accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`/api/clauses/universal${suffix}`, { accessToken, signal })
}

/**
 * @param {{ q?: string, accessToken?: string | null, signal?: AbortSignal, companyId?: string | null }} [options]
 */
export async function fetchCompanyClausesList({ q = '', accessToken, signal, companyId } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const headers = typeof companyId === 'string' && companyId.trim().length > 0 ? { 'X-Company-Id': companyId.trim() } : {}
  return apiGet(`/api/clauses/company${suffix}`, { accessToken, signal, headers })
}

export async function createUniversalClause(payload, { accessToken, signal } = {}) {
  return apiPost('/api/clauses/universal', payload, { accessToken, signal })
}

export async function createCompanyClause(payload, { accessToken, signal, companyId } = {}) {
  const headers = typeof companyId === 'string' && companyId.trim().length > 0 ? { 'X-Company-Id': companyId.trim() } : {}
  return apiPost('/api/clauses/company', payload, { accessToken, signal, headers })
}

export async function fetchClauseDetail(id, { accessToken, signal } = {}) {
  return apiGet(`/api/clauses/${id}`, { accessToken, signal })
}

export async function updateClause(id, payload, { accessToken, signal } = {}) {
  return apiPut(`/api/clauses/${id}`, payload, { accessToken, signal })
}

