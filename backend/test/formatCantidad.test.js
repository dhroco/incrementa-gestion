const test = require('node:test')
const assert = require('node:assert/strict')

const { parseCantidad, formatCantidad } = require('../utils/formatCantidad')

test('formatCantidad escribe la cantidad en palabras y cifra, sin unidad', () => {
  assert.equal(formatCantidad('30'), 'treinta (30)')
  assert.equal(formatCantidad(10), 'diez (10)')
  assert.equal(formatCantidad('45'), 'cuarenta y cinco (45)')
  assert.equal(formatCantidad(' 6 '), 'seis (6)')
})

test('formatCantidad apocopa «uno» según el género del sustantivo que sigue', () => {
  assert.equal(formatCantidad('1'), 'un (1)')
  assert.equal(formatCantidad('21'), 'veintiún (21)')
  assert.equal(formatCantidad('1', { fem: true }), 'una (1)')
  assert.equal(formatCantidad('21', { fem: true }), 'veintiuna (21)')
  assert.equal(formatCantidad('31', { fem: true }), 'treinta y una (31)')
})

test('parseCantidad solo acepta enteros positivos de hasta cuatro cifras', () => {
  assert.deepEqual(parseCantidad('30'), { ok: true, value: 30 })
  for (const bad of ['', '0', '-3', '3.5', '3,5', '30 días', 'treinta', 'abc', '12345', null, undefined]) {
    assert.equal(parseCantidad(bad).ok, false, `debe rechazar ${JSON.stringify(bad)}`)
  }
})

test('formatCantidad deja el valor como viene si no es una cantidad válida', () => {
  assert.equal(formatCantidad('treinta'), 'treinta')
  assert.equal(formatCantidad('0'), '0')
})
