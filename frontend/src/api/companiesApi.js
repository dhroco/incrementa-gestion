import { apiGet, apiPost, apiPut } from './apiClient'

/**
 * @param {{ q?: string?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchCompaniesList({ q = '', signal } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`/api/companies${suffix}`, { signal })
}

export async function fetchCompanyDetail(id, { signal } = {}) {
  return apiGet(`/api/companies/${id}`, { signal })
}

export async function createCompany(payload, { signal } = {}) {
  return apiPost('/api/companies', payload, { signal })
}

export async function updateCompany(id, payload, { signal } = {}) {
  return apiPut(`/api/companies/${id}`, payload, { signal })
}

