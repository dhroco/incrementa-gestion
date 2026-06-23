import { apiGet, apiPost, apiPut } from './apiClient'

export async function fetchClientsList({ search = '', signal } = {}) {
  const qs = new URLSearchParams()
  if (search) qs.set('search', search)
  const path = `/api/clients${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiGet(path, { signal })
}

export async function fetchClientById(id, { signal } = {}) {
  return apiGet(`/api/clients/${encodeURIComponent(id)}`, { signal })
}

export async function createClient(payload, { signal } = {}) {
  return apiPost('/api/clients', payload, { signal })
}

export async function updateClient(id, payload, { signal } = {}) {
  return apiPut(`/api/clients/${encodeURIComponent(id)}`, payload, { signal })
}
