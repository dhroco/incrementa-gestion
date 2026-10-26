import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./apiClient', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn()
}))

import { apiGet, apiPost } from './apiClient'
import { fetchInSignature, refreshSignature, resendSignatureLink, sendToFirme } from './contractSigningApi'

const signee = { firstName: 'Ana', lastName: 'Pérez', maternalLastName: 'Soto', documentNumber: '12.345.678-5', email: 'ana@ejemplo.cl' }

describe('contractSigningApi Firme', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiGet.mockResolvedValue({ ok: true, data: { items: [] }, meta: {} })
    apiPost.mockResolvedValue({ ok: true, data: {} })
  })

  it('Send calls the Firme endpoint', async () => {
    await sendToFirme('draft-1', signee)
    expect(apiPost).toHaveBeenCalledWith(
      '/api/contracts/draft-1/send-to-firme',
      { signee },
      { signal: undefined }
    )
  })

  it('loads in-signature, refresh and resend-link', async () => {
    await fetchInSignature({})
    await refreshSignature('draft-2')
    await resendSignatureLink('draft-3')
    expect(apiGet).toHaveBeenCalledWith('/api/contracts/in-signature', { signal: undefined })
    expect(apiPost).toHaveBeenCalledWith('/api/contracts/draft-2/refresh-signature', {}, { signal: undefined })
    expect(apiPost).toHaveBeenCalledWith('/api/contracts/draft-3/resend-link', {}, { signal: undefined })
  })
})
