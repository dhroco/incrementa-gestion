import appConfig from '../../config.js'
import { acquireApiAccessToken } from '../auth/msalToken'
import { apiGet, apiPost } from './apiClient'
function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

function withCompany(companyId, path, extraParams = {}) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && String(value).trim()) qs.set(key, String(value).trim())
  }
  const q = qs.toString()
  return q ? `${path}?${q}` : path
}

export async function fetchDocumentBuilderTemplates({ companyId, supplierType, signal } = {}) {
  return apiGet(
    withCompany(companyId, '/api/document-builder/templates', {
      supplier_type: supplierType
    }),
    { signal }
  )
}

export async function fetchDocumentBuilderTemplateDetail({ kind, id, companyId, signal } = {}) {
  const path = `/api/document-builder/templates/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`
  return apiGet(withCompany(companyId, path), { signal })
}

/**
 * @param {object} payload
 * @param {string=} payload.supplierId
 * @param {object=} payload.template
 * @param {object=} payload.missingFieldOverrides
 * @param {boolean=} payload.overwrite When true, replaces an existing active draft for the same supplier, template, and month.
 */
export async function postDocumentBuilderGenerate(payload, { companyId, signal } = {}) {
  return apiPost(withCompany(companyId, '/api/document-builder/generate'), payload, { signal })
}

/**
 * @returns {Promise<Blob>}
 */
export async function downloadDocumentBuilderPdf({ documentId, companyId, signal } = {}) {
  const accessToken = await acquireApiAccessToken()
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
  const url = `${baseUrl}/api/document-builder/downloads/${encodeURIComponent(documentId)}${qs}`
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
        : 'No se pudo descargar el documento.'
    throw new Error(msg)
  }
  return res.blob()
}
