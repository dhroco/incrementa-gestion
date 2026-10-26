import { apiGet, apiPost } from './apiClient'
import { fetchContractPdfBlob } from './contractsApi'

/**
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchPendingSignature({ signal } = {}) {
  return apiGet('/api/contracts/pending-signature', { signal })
}

/**
 * @param {string} id
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function signContract(id, { signal } = {}) {
  return apiPost(`/api/contracts/${encodeURIComponent(id)}/sign`, {}, { signal })
}

/**
 * @param {string} id
 * @param {{ firstName?: string, lastName?: string, maternalLastName?: string, documentNumber?: string, email?: string }} signee
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function sendToFirme(id, signee, { signal } = {}) {
  return apiPost(`/api/contracts/${encodeURIComponent(id)}/send-to-firme`, { signee }, { signal })
}

/**
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function fetchInSignature({ signal } = {}) {
  return apiGet('/api/contracts/in-signature', { signal })
}

/**
 * @param {string} id
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function refreshSignature(id, { signal } = {}) {
  return apiPost(`/api/contracts/${encodeURIComponent(id)}/refresh-signature`, {}, { signal })
}

/**
 * @param {string} id
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function resendSignatureLink(id, { signal } = {}) {
  return apiPost(`/api/contracts/${encodeURIComponent(id)}/resend-link`, {}, { signal })
}

/**
 * @param {string} id
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchDraftPdfBlob(id, { signal } = {}) {
  return fetchContractPdfBlob({ id, source: 'draft', signal })
}
