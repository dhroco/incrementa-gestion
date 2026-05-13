import { apiGet, apiPost, apiPut } from './apiClient'

export async function fetchInternalCompanyUsersList({ companyId, q = '', accessToken }) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  if (q) qs.set('q', q)
  const path = `/api/company-internal-users${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiGet(path, { accessToken })
}

export async function fetchInternalCompanyUserDetail({ id, companyId, accessToken }) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  const path = `/api/company-internal-users/${encodeURIComponent(id)}${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiGet(path, { accessToken })
}

export async function createInternalCompanyUser(payload, { companyId, accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  const path = `/api/company-internal-users${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiPost(path, payload, { accessToken, signal })
}

export async function updateInternalCompanyUser(id, payload, { companyId, accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  const path = `/api/company-internal-users/${encodeURIComponent(id)}${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiPut(path, payload, { accessToken, signal })
}
