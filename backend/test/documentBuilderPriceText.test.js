const test = require('node:test')
const assert = require('node:assert/strict')

const { preprocessMissingFieldOverrides, validatePriceTextOverride } = require('../services/documentBuilderService')

test('el precio en letras sale completo para $520.000', () => {
  const out = preprocessMissingFieldOverrides({ precio_numero: '520.000' })
  assert.equal(out.precio_numero, '$520.000')
  assert.equal(out.precio_texto, 'quinientos veinte mil')
})

test('un precio_texto manual distinto del calculado se rechaza con un error explícito', () => {
  const result = validatePriceTextOverride({ precio_numero: '520000', precio_texto: 'quinientos mil' })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'PAIR_FIELD_OVERRIDE_NOT_ALLOWED')
  assert.match(result.message, /se calcula automáticamente/)
})

test('un precio_texto igual al calculado se acepta (con o sin «pesos» y con otras mayúsculas)', () => {
  for (const text of ['quinientos veinte mil', 'Quinientos veinte mil pesos', '  QUINIENTOS  VEINTE MIL ']) {
    assert.deepEqual(validatePriceTextOverride({ precio_numero: '520.000', precio_texto: text }), { ok: true }, text)
  }
})

test('sin precio_texto, sin precio_numero o con un precio inválido no se valida nada aquí', () => {
  assert.deepEqual(validatePriceTextOverride({ precio_numero: '520000' }), { ok: true })
  assert.deepEqual(validatePriceTextOverride({ precio_texto: 'lo que sea' }), { ok: true })
  assert.deepEqual(validatePriceTextOverride({ precio_numero: 'abc', precio_texto: 'lo que sea' }), { ok: true })
  assert.deepEqual(validatePriceTextOverride(undefined), { ok: true })
})
