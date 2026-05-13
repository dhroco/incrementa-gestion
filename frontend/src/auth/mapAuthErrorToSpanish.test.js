import { describe, expect, it } from 'vitest'
import { mapAuthErrorToSpanish } from './mapAuthErrorToSpanish'

describe('mapAuthErrorToSpanish', () => {
  it('maps invalid login credentials', () => {
    expect(
      mapAuthErrorToSpanish({ message: 'Invalid login credentials', code: 'invalid_credentials' })
    ).toContain('incorrectos')
  })

  it('maps email not confirmed', () => {
    expect(mapAuthErrorToSpanish({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toContain(
      'confirmar'
    )
  })

  it('maps network-style errors', () => {
    expect(mapAuthErrorToSpanish({ message: 'Failed to fetch', code: 'network_error' })).toContain('conexión')
  })

  it('handles null or undefined', () => {
    expect(mapAuthErrorToSpanish(null)).toMatch(/error/i)
  })
})
