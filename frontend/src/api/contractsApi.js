import appConfig from '../../config.js'
import { acquireApiAccessToken } from '../auth/msalToken'
import { apiGet } from './apiClient'
function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

/**
 * @param {{ page?: number, filters?: object?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchContracts({ page = 1, filters = {}, signal } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', '18')

  if (filters.supplierId) params.set('supplierId', filters.supplierId)
  else if (filters.supplierSearch) params.set('supplierSearch', filters.supplierSearch)
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.templateId) params.set('templateId', filters.templateId)
  if (filters.redSocialSearch) params.set('redSocialSearch', filters.redSocialSearch)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)

  return apiGet(`/api/contracts?${params.toString()}`, { signal })
}

/**
 * @param {{ id: string, source: 'draft' | 'signed'?: string | null, signal?: AbortSignal }} options
 * @returns {Promise<Blob>}
 */
export async function fetchContractPdfBlob({ id, source, signal } = {}) {
  const accessToken = await acquireApiAccessToken()
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const params = new URLSearchParams()
  params.set('source', source)
  const url = `${baseUrl}/api/contracts/${encodeURIComponent(id)}/pdf?${params.toString()}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    signal
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : 'No se pudo abrir el contrato.'
    throw new Error(msg)
  }
  return res.blob()
}
