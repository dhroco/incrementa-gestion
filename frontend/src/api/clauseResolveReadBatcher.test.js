import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolveClauseContentReadBatched } from './clauseResolveReadBatcher'

vi.mock('./apiClient', () => ({
  apiPost: vi.fn(),
}))

import { apiPost } from './apiClient'

describe('resolveClauseContentReadBatched', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dedupes concurrent resolves into a single apiPost batch', async () => {
    vi.useFakeTimers()
    apiPost.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        items: [
          {
            clause_id: 'u1',
            clause_kind: 'universal',
            company_id: null,
            ok: true,
            clause: { content_json: { type: 'doc', content: [{ type: 'paragraph', content: [] }] } },
          },
        ],
      },
    })

    const p1 = resolveClauseContentReadBatched({ accessToken: 't', clauseId: 'u1', clauseKind: 'universal' })
    const p2 = resolveClauseContentReadBatched({ accessToken: 't', clauseId: 'u1', clauseKind: 'universal' })

    await vi.runAllTimersAsync()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
  })
})
