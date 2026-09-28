import { describe, expect, it } from 'vitest'
import { sanitizePastedPlainText } from './sanitizePastedPlainText'

describe('sanitizePastedPlainText control characters', () => {
  it('strips controls between letters', () => {
    expect(sanitizePastedPlainText('a\u0000b\u0007c\u001Fd\u007Fe')).toBe('abcde')
  })

  it('keeps a newline and turns vertical tab and form feed into newlines', () => {
    expect(sanitizePastedPlainText('línea\nvertical\vform\ffinal')).toBe(
      'línea\nvertical\nform\nfinal'
    )
  })

  it('returns plain text unchanged', () => {
    expect(sanitizePastedPlainText('Contrato vigente')).toBe('Contrato vigente')
  })
})
