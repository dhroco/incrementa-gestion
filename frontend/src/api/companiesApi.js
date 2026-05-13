import { apiGet, apiPost, apiPut } from './apiClient'

/**
 * @param {{ q?: string, accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchCompaniesList({ q = '', accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`/api/companies${suffix}`, { accessToken, signal })
}

export async function fetchCompanyDetail(id, { accessToken, signal } = {}) {
  return apiGet(`/api/companies/${id}`, { accessToken, signal })
}

export async function createCompany(payload, { accessToken, signal } = {}) {
  return apiPost('/api/companies', payload, { accessToken, signal })
}

export async function updateCompany(id, payload, { accessToken, signal } = {}) {
  return apiPut(`/api/companies/${id}`, payload, { accessToken, signal })
}

export async function fetchAccountantsCatalog({ accessToken, signal } = {}) {
  return apiGet('/api/accountants', { accessToken, signal })
}

export async function fetchCompanyAccountants(id, { accessToken, signal } = {}) {
  return apiGet(`/api/companies/${id}/accountants`, { accessToken, signal })
}

export async function setCompanyAccountants(id, accountantIds, { accessToken, signal } = {}) {
  return apiPut(`/api/companies/${id}/accountants`, { accountant_ids: accountantIds }, { accessToken, signal })
}

