const test = require('node:test')
const assert = require('node:assert/strict')
const { validateCompanyPayload } = require('../services/companyService')

const validBase = {
  business_name: 'Dynamics Corp. SpA',
  short_name: 'Dynamics',
  rut: '76123456-0'
}

test('Company RUT with a mistyped digit', () => {
  const result = validateCompanyPayload({ ...validBase, rut: '12.345.678-9' }, { requireAll: true })
  assert.equal(result.ok, false)
  assert.equal(
    result.errors.includes('El dígito verificador no corresponde al RUT ingresado.'),
    true
  )
})

test('Partial company edit rejects a mistyped RUT', () => {
  const result = validateCompanyPayload({ rut: '12.345.678-9' }, { requireAll: false })
  assert.equal(result.ok, false)
  assert.equal(
    result.errors.includes('El dígito verificador no corresponde al RUT ingresado.'),
    true
  )
})

test('Legal representative body and matching digit', () => {
  const result = validateCompanyPayload({
    rut_body_legal_representative_1: '12345678',
    rut_dv_legal_representative_1: '5'
  })
  assert.equal(result.ok, true)
  assert.equal(result.data.rut_body_legal_representative_1, '12345678')
  assert.equal(result.data.rut_dv_legal_representative_1, '5')
})

test('Legal representative digit does not match', () => {
  const result = validateCompanyPayload({
    rut_body_legal_representative_1: '12345678',
    rut_dv_legal_representative_1: '9'
  })
  assert.equal(result.ok, false)
})

test('Legal representative body without a digit', () => {
  const result = validateCompanyPayload({
    rut_body_legal_representative_1: '12345678'
  })
  assert.equal(result.ok, false)
})
