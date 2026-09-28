const test = require('node:test')
const assert = require('node:assert/strict')
const {
  SEED_IDENTITY_DOCUMENT_TYPES,
  validateIdentityDocument
} = require('../utils/identityDocument')

const RUT = SEED_IDENTITY_DOCUMENT_TYPES.find((t) => t.code === 'RUT')

test('Chilean RUT with a mismatched verificador is rejected', () => {
  const r = validateIdentityDocument({
    value: '12.345.678-9',
    documentType: RUT,
    role: 'persona_natural'
  })
  assert.equal(r.ok, false)
  assert.equal(r.message, 'El dígito verificador no corresponde al RUT ingresado.')
  assert.notEqual(r.canonical, '12345678-5')
})

test('Chilean RUT with a matching verificador is stored canonically', () => {
  const r = validateIdentityDocument({
    value: '12.345.678-5',
    documentType: RUT,
    role: 'persona_natural'
  })
  assert.equal(r.ok, true)
  assert.equal(r.canonical, '12345678-5')
})
