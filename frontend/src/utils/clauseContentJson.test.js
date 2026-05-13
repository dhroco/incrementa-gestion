import { describe, expect, it } from 'vitest'
import { validateClauseContentJsonClient } from './clauseContentJson'

const validDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

describe('validateClauseContentJsonClient', () => {
  it('accepts minimal TipTap doc', () => {
    expect(validateClauseContentJsonClient(validDoc).ok).toBe(true)
  })

  it('rejects empty doc', () => {
    const r = validateClauseContentJsonClient({ type: 'doc', content: [] })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/vacío/i)
  })
})
