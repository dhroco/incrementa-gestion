const test = require('node:test')
const assert = require('node:assert/strict')

const {
  preprocessMissingFieldOverrides,
  validatePriceTextOverride,
  SECONDARY_FIELDS
} = require('../services/documentBuilderService')

test('pago_dinero_texto es el par automático de pago_dinero_numero (nunca aparece como campo faltante)', () => {
  assert.equal(SECONDARY_FIELDS.pago_dinero_texto, 'pago_dinero_numero')
  assert.equal(SECONDARY_FIELDS.precio_texto, 'precio_numero')
})

test('el pago en dinero se formatea y se escribe en letras como el precio', () => {
  const out = preprocessMissingFieldOverrides({ precio_numero: '520.000', pago_dinero_numero: '40000' }, { currencyCode: 'CLP' })
  assert.equal(out.precio_numero, '$520.000')
  assert.equal(out.precio_texto, 'quinientos veinte mil')
  assert.equal(out.pago_dinero_numero, '$40.000')
  assert.equal(out.pago_dinero_texto, 'cuarenta mil')
})

test('sin pago en dinero no se agrega nada y el precio sigue igual', () => {
  const out = preprocessMissingFieldOverrides({ precio_numero: '500000' })
  assert.equal(out.pago_dinero_numero, undefined)
  assert.equal(out.pago_dinero_texto, undefined)
  assert.equal(out.precio_texto, 'quinientos mil')
})

test('un pago_dinero_texto manual distinto del calculado se rechaza; igual al calculado se acepta', () => {
  const bad = validatePriceTextOverride({ pago_dinero_numero: '40000', pago_dinero_texto: 'cuarenta mil quinientos' })
  assert.equal(bad.ok, false)
  assert.equal(bad.code, 'PAIR_FIELD_OVERRIDE_NOT_ALLOWED')
  assert.match(bad.message, /pago en dinero en letras/)
  assert.deepEqual(validatePriceTextOverride({ pago_dinero_numero: '40.000', pago_dinero_texto: 'Cuarenta mil pesos' }), { ok: true })
})

test('el rechazo del precio sigue funcionando junto al del pago en dinero', () => {
  const bad = validatePriceTextOverride({
    precio_numero: '520000',
    precio_texto: 'quinientos mil',
    pago_dinero_numero: '40000',
    pago_dinero_texto: 'cuarenta mil'
  })
  assert.equal(bad.ok, false)
  assert.match(bad.message, /precio en letras/)
})
