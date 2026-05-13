import { describe, expect, it } from 'vitest'
import { classifyApiFailure, mapHttpStatusToSpanish } from './apiClient'

describe('apiClient error mapping', () => {
  it('classifyApiFailure maps common statuses', () => {
    expect(classifyApiFailure(401)).toBe('unauthorized')
    expect(classifyApiFailure(403)).toBe('forbidden')
    expect(classifyApiFailure(404)).toBe('not_found')
    expect(classifyApiFailure(500)).toBe('server')
    expect(classifyApiFailure(418)).toBe('unknown')
  })

  it('mapHttpStatusToSpanish returns Spanish messages', () => {
    expect(mapHttpStatusToSpanish(401)).toMatch(/No autorizado/i)
    expect(mapHttpStatusToSpanish(403)).toMatch(/Acceso denegado/i)
    expect(mapHttpStatusToSpanish(404)).toMatch(/No se encontró/i)
  })
})

