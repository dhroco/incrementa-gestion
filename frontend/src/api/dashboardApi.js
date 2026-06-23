import { apiGet } from './apiClient'

export async function fetchDashboardStats({ signal } = {}) {
  return apiGet('/api/dashboard/stats', { signal })
}
