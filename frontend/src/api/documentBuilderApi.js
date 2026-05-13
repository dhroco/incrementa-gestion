import appConfig from '../../config.js'
import { apiGet, apiPost } from './apiClient'

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

function withCompany(companyId, path) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  const q = qs.toString()
  return q ? `${path}?${q}` : path
}

export async function fetchDocumentBuilderTemplates({ companyId, accessToken, signal } = {}) {
  return apiGet(withCompany(companyId, '/api/document-builder/templates'), { accessToken, signal })
}

export async function fetchDocumentBuilderTemplateDetail({ kind, id, companyId, accessToken, signal } = {}) {
  const path = `/api/document-builder/templates/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`
  return apiGet(withCompany(companyId, path), { accessToken, signal })
}

/**
 * @param {object} payload
 * @param {string[]=} payload.employeeIds
 * @param {object=} payload.template
 * @param {object=} payload.missingFieldOverrides
 * @param {string=} [payload.renderEngine] `'pdf-lib'` (default) or `'react-pdf'`
 */
export async function postDocumentBuilderGenerate(payload, { companyId, accessToken, signal } = {}) {
  return apiPost(withCompany(companyId, '/api/document-builder/generate'), payload, { accessToken, signal })
}

/**
 * @returns {Promise<Blob>}
 */
export async function downloadDocumentBuilderPdf({ documentId, companyId, accessToken, signal } = {}) {
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
