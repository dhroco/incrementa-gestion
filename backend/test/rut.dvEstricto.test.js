const test = require('node:test')
const assert = require('node:assert/strict')

const { computeRutDv, parseRut } = require('../utils/rut')

function assertRejected(input, { code, message, bodyForExpectedDv }) {
  const r = parseRut(input)
  assert.equal(r.ok, false)
  assert.equal(r.code, code)
  assert.equal(r.message, message)
  assert.equal(r.rut_body, undefined)
  assert.equal(r.rut_dv, undefined)
  if (input != null && String(input).length > 0) {
    assert.equal(r.message.includes(String(input)), false)
  }
  if (bodyForExpectedDv != null) {
    const expectedDigit = computeRutDv(bodyForExpectedDv)
    assert.ok(expectedDigit)
    assert.equal(r.message.includes(expectedDigit), false)
  }
  return r
}

test('Valid 8-digit RUT with or without separators', () => {
  for (const input of ['12.345.678-5', '12345678-5', '123456785']) {
    const r = parseRut(input)
    assert.equal(r.ok, true)
    assert.equal(r.rut_body, '12345678')
    assert.equal(r.rut_dv, '5')
  }
})

test('Valid 7-digit RUT', () => {
  for (const input of ['1.234.567-4', '12345674']) {
    const r = parseRut(input)
    assert.equal(r.ok, true)
    assert.equal(r.rut_body, '1234567')
    assert.equal(r.rut_dv, '4')
  }
})

test('Verificador K is accepted in either case', () => {
  for (const input of ['10.000.013-K', '10.000.013-k']) {
    const r = parseRut(input)
    assert.equal(r.ok, true)
    assert.equal(r.rut_body, '10000013')
    assert.equal(r.rut_dv, 'K')
  }
  const sevenK = parseRut('1.000.005-K')
  assert.equal(sevenK.ok, true)
  assert.equal(sevenK.rut_body, '1000005')
  assert.equal(sevenK.rut_dv, 'K')
  const sevenZero = parseRut('1.000.013-0')
  assert.equal(sevenZero.ok, true)
  assert.equal(sevenZero.rut_body, '1000013')
  assert.equal(sevenZero.rut_dv, '0')
})

test('Mistyped verificador is rejected', () => {
  const cases = [
    { input: '12.345.678-9', body: '12345678' },
    { input: '1.234.567-9', body: '1234567' },
    { input: '10.000.013-0', body: '10000013' }
  ]
  for (const { input, body } of cases) {
    const r = assertRejected(input, {
      code: 'RUT_DV_MISMATCH',
      message: 'El dígito verificador no corresponde al RUT ingresado.',
      bodyForExpectedDv: body
    })
    assert.equal(r.code, 'RUT_DV_MISMATCH')
  }
})

test('Eight digits without a hyphen are body plus digit', () => {
  assertRejected('12345678', {
    code: 'RUT_DV_MISMATCH',
    message: 'El dígito verificador no corresponde al RUT ingresado.',
    bodyForExpectedDv: '1234567'
  })
})

test('Wrong length is invalid', () => {
  for (const input of ['123456', '1234567890']) {
    assertRejected(input, {
      code: 'RUT_INVALID',
      message: 'El RUT ingresado no es válido.',
      bodyForExpectedDv: input.slice(0, -1)
    })
  }
})

test('Six-digit body is invalid', () => {
  assertRejected('1234567', {
    code: 'RUT_INVALID',
    message: 'El RUT ingresado no es válido.',
    bodyForExpectedDv: '123456'
  })
})

test('Verificador outside 0-9 or K is invalid', () => {
  assertRejected('12345678-X', {
    code: 'RUT_INVALID',
    message: 'El RUT ingresado no es válido.',
    bodyForExpectedDv: '12345678'
  })
})

test('A non-digit inside the body is invalid', () => {
  assertRejected('1K34567-4', {
    code: 'RUT_INVALID',
    message: 'El RUT ingresado no es válido.',
    bodyForExpectedDv: '134567'
  })
})

test('Empty input is required', () => {
  for (const input of ['', null, '  ']) {
    assertRejected(input, {
      code: 'RUT_EMPTY',
      message: 'El RUT es obligatorio.'
    })
  }
})
