import { apiGet, apiPost, apiPut } from './apiClient'

export async function fetchAccountantsPlatformList({ q = '', accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (trimmed.length > 0) qs.set('q', trimmed)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet(`/api/platform/accountants${suffix}`, { accessToken, signal })
}

export async function fetchAccountantPlatformDetail(id, { accessToken, signal } = {}) {
  return apiGet(`/api/platform/accountants/${id}`, { accessToken, signal })
}

export async function createAccountantPlatform(payload, { accessToken, signal } = {}) {
  return apiPost('/api/platform/accountants', payload, { accessToken, signal })
}

export async function updateAccountantPlatform(id, payload, { accessToken, signal } = {}) {
  return apiPut(`/api/platform/accountants/${id}`, payload, { accessToken, signal })
}

export async function postPasswordRotationComplete({ accessToken, signal } = {}) {
  return apiPost('/api/me/password-rotation-complete', {}, { accessToken, signal })
}
