import { apiGet, apiPost, apiPut } from './apiClient'

export async function fetchPlatformUsersList({ q = '', accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`/api/platform/users${suffix}`, { accessToken, signal })
}

export async function fetchPlatformUserDetail(id, { accessToken, signal } = {}) {
  return apiGet(`/api/platform/users/${id}`, { accessToken, signal })
}

export async function createPlatformUser(payload, { accessToken, signal } = {}) {
  return apiPost('/api/platform/users', payload, { accessToken, signal })
}

export async function updatePlatformUser(id, payload, { accessToken, signal } = {}) {
  return apiPut(`/api/platform/users/${id}`, payload, { accessToken, signal })
}
