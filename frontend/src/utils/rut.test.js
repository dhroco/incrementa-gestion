import { describe, expect, it } from 'vitest'
import { computeRutDv, parseRut } from './rut'

describe('rut utils', () => {
  it('computeRutDv computes known DV', () => {
    expect(computeRutDv('11111111')).toBe('1')
    expect(computeRutDv('76543210')).toBe('3')
  })

  it('parseRut accepts dotted/hyphenated with DV', () => {
    const r = parseRut('76.543.210-3')
    expect(r.ok).toBe(true)
    expect(r.rutBody).toBe('76543210')
    expect(r.rutDv).toBe('3')
  })

  it('parseRut accepts without DV and computes it', () => {
    const r = parseRut('76543210')
    expect(r.ok).toBe(true)
    expect(r.rutDv).toBe('3')
  })

  it('parseRut corrects a mistyped digit verificador when body is valid', () => {
    const r = parseRut('76.543.210-1')
    expect(r.ok).toBe(true)
    expect(r.rutBody).toBe('76543210')
    expect(r.rutDv).toBe('3')
  })
})

