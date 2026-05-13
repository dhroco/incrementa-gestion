import { describe, expect, it } from 'vitest'
import { CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES } from './clauseMessages'

describe('clauseMessages', () => {
  it('company duplicate fallback is scoped to this company (es-CL)', () => {
    expect(CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES).toMatch(/esta empresa/i)
    expect(CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES.toLowerCase()).not.toContain('sistema')
  })
})
