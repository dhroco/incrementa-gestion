import { describe, expect, it } from 'vitest'
import {
  isCompanyRutConflictResponse,
  isCompanyRutDuplicateUserMessage,
  userMessageFromCompanySaveFailure
} from './companyApiErrors'

describe('userMessageFromCompanySaveFailure', () => {
  it('uses backend message for RUT duplicate when present', () => {
    const msg = userMessageFromCompanySaveFailure({
      ok: false,
      status: 409,
      code: 'RUT_DUPLICATED',
      message: 'Ya existe una empresa con ese RUT.'
    })
    expect(msg).toBe('Ya existe una empresa con ese RUT.')
  })

  it('falls back when 409 has no message', () => {
    const msg = userMessageFromCompanySaveFailure({ ok: false, status: 409, code: 'RUT_DUPLICATED', message: '' })
    expect(msg).toContain('ya está registrado')
  })

  it('detects RUT conflict by code', () => {
    expect(isCompanyRutConflictResponse({ ok: false, status: 400, code: 'RUT_DUPLICATED', message: 'x' })).toBe(true)
  })

  it('returns validation message for 400', () => {
    expect(
      userMessageFromCompanySaveFailure({
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'El RUT ingresado no es válido.'
      })
    ).toBe('El RUT ingresado no es válido.')
  })
})

describe('isCompanyRutDuplicateUserMessage', () => {
  it('matches backend duplicate copy', () => {
    expect(isCompanyRutDuplicateUserMessage('Ya existe una empresa con ese RUT.')).toBe(true)
  })

  it('matches fallback copy', () => {
    expect(isCompanyRutDuplicateUserMessage('Este RUT de empresa ya está registrado. Use otro.')).toBe(true)
  })

  it('rejects unrelated errors', () => {
    expect(isCompanyRutDuplicateUserMessage('No se pudo conectar al servidor.')).toBe(false)
  })
})
