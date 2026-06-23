import { apiDelete, apiGet, apiPost, apiPut } from './apiClient'

export async function fetchRolesList({ signal } = {}) {
  return apiGet('/api/roles', { signal })
}

export async function fetchRoleById(id, { signal } = {}) {
  return apiGet(`/api/roles/${encodeURIComponent(id)}`, { signal })
}

export async function createRole(payload, { signal } = {}) {
  return apiPost('/api/roles', payload, { signal })
}

export async function updateRoleLabel(id, { label }, { signal } = {}) {
  return apiPut(`/api/roles/${encodeURIComponent(id)}/label`, { label }, { signal })
}

export async function deleteRole(id, { signal } = {}) {
  return apiDelete(`/api/roles/${encodeURIComponent(id)}`, { signal })
}

export async function saveRolePermissions(id, permissions, { signal } = {}) {
  return apiPut(`/api/roles/${encodeURIComponent(id)}/permissions`, { permissions }, { signal })
}
