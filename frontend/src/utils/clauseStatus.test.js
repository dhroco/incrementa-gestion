import { describe, expect, it } from 'vitest'
import { mapClauseStatusToSpanish } from './clauseStatus'

describe('mapClauseStatusToSpanish', () => {
  it('maps known statuses', () => {
    expect(mapClauseStatusToSpanish('draft')).toBe('Borrador')
    expect(mapClauseStatusToSpanish('active')).toBe('Activa')
    expect(mapClauseStatusToSpanish('inactive')).toBe('Inactiva')
  })

  it('is case/space tolerant', () => {
    expect(mapClauseStatusToSpanish('  ACTIVE ')).toBe('Activa')
  })

  it('returns dash for invalid/empty', () => {
    expect(mapClauseStatusToSpanish('')).toBe('—')
    expect(mapClauseStatusToSpanish(null)).toBe('—')
    expect(mapClauseStatusToSpanish('unknown')).toBe('—')
  })
})

