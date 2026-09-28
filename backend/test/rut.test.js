const test = require('node:test')
const assert = require('node:assert/strict')

const { computeRutDv, parseRut } = require('../utils/rut')

test('computeRutDv computes known DV', () => {
  assert.equal(computeRutDv('11111111'), '1')
  assert.equal(computeRutDv('76543210'), '3')
})

test('parseRut accepts dotted/hyphenated input with DV', () => {
  const r = parseRut('76.543.210-3')
  assert.equal(r.ok, true)
  assert.equal(r.rut_body, '76543210')
  assert.equal(r.rut_dv, '3')
})

test('parseRut reads the last character as DV when there is no hyphen', () => {
  const r = parseRut('76543210')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'RUT_DV_MISMATCH')
  assert.equal(r.message, 'El dígito verificador no corresponde al RUT ingresado.')
})

test('parseRut rejects a mistyped digit verificador', () => {
  const r = parseRut('76.543.210-1')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'RUT_DV_MISMATCH')
  assert.equal(r.message, 'El dígito verificador no corresponde al RUT ingresado.')
})

