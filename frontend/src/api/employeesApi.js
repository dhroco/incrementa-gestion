import { apiGet, apiPost, apiPut } from './apiClient'

function withCompany(companyId, path) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  const q = qs.toString()
  return q ? `${path}?${q}` : path
}

export async function fetchEmployeesLookup({ companyId, accessToken, signal } = {}) {
  return apiGet(withCompany(companyId, '/api/employees/lookup'), { accessToken, signal })
}

export async function fetchEmployeesList({ companyId, q = '', accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  if (q) qs.set('q', q)
  const path = `/api/employees${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiGet(path, { accessToken, signal })
}

export async function fetchEmployeeDetail({ id, companyId, accessToken, signal } = {}) {
  return apiGet(withCompany(companyId, `/api/employees/${encodeURIComponent(id)}`), { accessToken, signal })
}

export async function createEmployee(payload, { companyId, accessToken, signal } = {}) {
  return apiPost(withCompany(companyId, '/api/employees'), payload, { accessToken, signal })
}

export async function updateEmployee(id, payload, { companyId, accessToken, signal } = {}) {
  return apiPut(withCompany(companyId, `/api/employees/${encodeURIComponent(id)}`), payload, { accessToken, signal })
}
