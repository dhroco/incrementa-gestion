import { describe, it, expect } from 'vitest'
import { formatLastChangeDate } from './lastChangeDate'

describe('formatLastChangeDate', () => {
  it('returns dash when missing', () => {
    expect(formatLastChangeDate(null)).toBe('—')
    expect(formatLastChangeDate(undefined)).toBe('—')
    expect(formatLastChangeDate('')).toBe('—')
  })

  it('formats as date only (no time)', () => {
    const out = formatLastChangeDate('2026-04-16T10:20:30.000Z')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
    // no time fragment like "10:20"
    expect(out.includes(':')).toBe(false)
    // should contain some digits
    expect(/\d/.test(out)).toBe(true)
  })
})

