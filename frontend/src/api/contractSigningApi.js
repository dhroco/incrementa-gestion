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
 * @param {{ accessToken?: string | null, signal?: AbortSignal }} [options]
 */
export async function fetchDraftPdfBlob(id, { signal } = {}) {
  return fetchContractPdfBlob({ id, source: 'draft', signal })
}
