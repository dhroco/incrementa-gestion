import { apiGet, apiPost, apiPut } from './apiClient'

export async function fetchPlatformUserRoleOptions({ signal } = {}) {
  return apiGet('/api/platform/users/roles', { signal })
}

export async function fetchPlatformUsersList({ q = '', signal } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`/api/platform/users${suffix}`, { signal })
}

export async function fetchPlatformUserDetail(id, { signal } = {}) {
  return apiGet(`/api/platform/users/${id}`, { signal })
}

export async function createPlatformUser(payload, { signal } = {}) {
  return apiPost('/api/platform/users', payload, { signal })
}

export async function updatePlatformUser(id, payload, { signal } = {}) {
  return apiPut(`/api/platform/users/${id}`, payload, { signal })
}
