import { describe, expect, it } from 'vitest'
import { computeRutDv, formatRut, formatRutDisplay, formatRutInput, parseRut } from './rut'

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

  it('formatRut applies thousands separator and hyphen', () => {
    expect(formatRut('76543210', '3')).toBe('76.543.210-3')
    expect(formatRut('12345678', '5')).toBe('12.345.678-5')
  })

  it('formatRutDisplay formats raw or partial strings', () => {
    expect(formatRutDisplay('76543210-3')).toBe('76.543.210-3')
    expect(formatRutDisplay('76.543.210-3')).toBe('76.543.210-3')
    expect(formatRutDisplay('')).toBe('—')
    expect(formatRutDisplay(null)).toBe('—')
  })

  it('formatRutInput formats on blur-style normalization', () => {
    expect(formatRutInput('765432103')).toBe('76.543.210-3')
    expect(formatRutInput('76.543.210-3')).toBe('76.543.210-3')
    expect(formatRutInput('')).toBe('')
    expect(formatRutInput('abc')).toBe('abc')
  })
})

