import { describe, expect, it } from 'vitest'
import { computeRutDv, formatRutInput, parseRut } from './rut'

describe('rut utils', () => {
  function assertRejected(input, { message, bodyForExpectedDv }) {
    const r = parseRut(input)
    expect(r.ok).toBe(false)
    expect(r.message).toBe(message)
    expect(r.rutBody).toBeUndefined()
    expect(r.rutDv).toBeUndefined()
    if (input != null && String(input).length > 0) {
      expect(r.message.includes(String(input))).toBe(false)
    }
    if (bodyForExpectedDv != null) {
      const expectedDigit = computeRutDv(bodyForExpectedDv)
      expect(expectedDigit).toBeTruthy()
      expect(r.message.includes(expectedDigit)).toBe(false)
    }
  }

  it('Valid 8-digit RUT with or without separators', () => {
    for (const input of ['12.345.678-5', '12345678-5', '123456785']) {
      const r = parseRut(input)
      expect(r.ok).toBe(true)
      expect(r.rutBody).toBe('12345678')
      expect(r.rutDv).toBe('5')
    }
  })

  it('Valid 7-digit RUT', () => {
    for (const input of ['1.234.567-4', '12345674']) {
      const r = parseRut(input)
      expect(r.ok).toBe(true)
      expect(r.rutBody).toBe('1234567')
      expect(r.rutDv).toBe('4')
    }
  })

  it('Verificador K is accepted in either case', () => {
    for (const input of ['10.000.013-K', '10.000.013-k']) {
      const r = parseRut(input)
      expect(r.ok).toBe(true)
      expect(r.rutBody).toBe('10000013')
      expect(r.rutDv).toBe('K')
    }
    const sevenK = parseRut('1.000.005-K')
    expect(sevenK.ok).toBe(true)
    expect(sevenK.rutBody).toBe('1000005')
    expect(sevenK.rutDv).toBe('K')
    const sevenZero = parseRut('1.000.013-0')
    expect(sevenZero.ok).toBe(true)
    expect(sevenZero.rutBody).toBe('1000013')
    expect(sevenZero.rutDv).toBe('0')
  })

  it('Mistyped verificador is rejected', () => {
    const cases = [
      { input: '12.345.678-9', body: '12345678' },
      { input: '1.234.567-9', body: '1234567' },
      { input: '10.000.013-0', body: '10000013' }
    ]
    for (const { input, body } of cases) {
      assertRejected(input, {
        message: 'El dígito verificador no corresponde al RUT ingresado.',
        bodyForExpectedDv: body
      })
    }
  })

  it('Eight digits without a hyphen are body plus digit', () => {
    assertRejected('12345678', {
      message: 'El dígito verificador no corresponde al RUT ingresado.',
      bodyForExpectedDv: '1234567'
    })
  })

  it('Wrong length is invalid', () => {
    for (const input of ['123456', '1234567890']) {
      assertRejected(input, {
        message: 'El RUT ingresado no es válido.',
        bodyForExpectedDv: input.slice(0, -1)
      })
    }
  })

  it('Six-digit body is invalid', () => {
    assertRejected('1234567', {
      message: 'El RUT ingresado no es válido.',
      bodyForExpectedDv: '123456'
    })
  })

  it('Verificador outside 0-9 or K is invalid', () => {
    assertRejected('12345678-X', {
      message: 'El RUT ingresado no es válido.',
      bodyForExpectedDv: '12345678'
    })
  })

  it('A non-digit inside the body is invalid', () => {
    assertRejected('1K34567-4', {
      message: 'El RUT ingresado no es válido.',
      bodyForExpectedDv: '134567'
    })
  })

  it('Empty input is required', () => {
    for (const input of ['', null, '  ']) {
      assertRejected(input, { message: 'El RUT es obligatorio.' })
    }
  })

  it('Blur keeps a mistyped RUT', () => {
    expect(formatRutInput('12.345.678-9')).toBe('12.345.678-9')
  })
})
