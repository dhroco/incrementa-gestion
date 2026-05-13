import { describe, expect, it, vi } from 'vitest'
import { fetchEnrichedSession } from './enrichedSessionApi'

describe('fetchEnrichedSession', () => {
  it('calls /api/me/session with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'u1', email: 'a@b.cl', profile: { code: 'X', label: 'Y' } })
    })
    globalThis.fetch = fetchMock

    const res = await fetchEnrichedSession('http://localhost:3000', 'tok')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/me/session',
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok' }
      })
    )
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })
})
