import appConfig from '../../config.js'
import { acquireApiAccessToken } from '../auth/msalToken'
import { apiGet, apiPost, apiPut } from './apiClient'
function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

export async function fetchSuppliersList({ search = '', signal } = {}) {
  const qs = new URLSearchParams()
  if (search) qs.set('search', search)
  const path = `/api/suppliers${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiGet(path, { signal })
}

export async function fetchSupplierDetail({ id, signal } = {}) {
  return apiGet(`/api/suppliers/${encodeURIComponent(id)}`, { signal })
}

export async function createSupplier(payload, { signal } = {}) {
  return apiPost('/api/suppliers', payload, { signal })
}

export async function updateSupplier(id, payload, { signal } = {}) {
  return apiPut(`/api/suppliers/${encodeURIComponent(id)}`, payload, { signal })
}

export async function fetchSupplierDocuments({ id, signal } = {}) {
  return apiGet(`/api/suppliers/${encodeURIComponent(id)}/documents`, { signal })
}

export async function fetchSocialNetworkCatalog({ signal } = {}) {
  return apiGet('/api/social-networks/catalog', { signal })
}

/**
 * @returns {Promise<Blob>}
 */
export async function downloadSupplierDocumentPdf({ supplierId, documentId, signal } = {}) {
  const accessToken = await acquireApiAccessToken()
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const url = `${baseUrl}/api/suppliers/${encodeURIComponent(supplierId)}/documents/${encodeURIComponent(documentId)}/view`
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
        : 'No se pudo abrir el documento.'
    throw new Error(msg)
  }
  return res.blob()
}
