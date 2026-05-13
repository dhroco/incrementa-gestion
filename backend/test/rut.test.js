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

test('parseRut accepts input without DV and computes it', () => {
  const r = parseRut('76543210')
  assert.equal(r.ok, true)
  assert.equal(r.rut_body, '76543210')
  assert.equal(r.rut_dv, '3')
})

test('parseRut corrects a mistyped digit verificador when body is valid', () => {
  const r = parseRut('76.543.210-1')
  assert.equal(r.ok, true)
  assert.equal(r.rut_body, '76543210')
  assert.equal(r.rut_dv, '3')
})

