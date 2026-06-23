const test = require('node:test')
const assert = require('node:assert/strict')
const { validateCompanyPayload } = require('../services/companyService')

const validBase = {
  business_name: 'Dynamics Corp. SpA',
  short_name: 'Dynamics',
  rut: '76123456-7'
}

test('validateCompanyPayload requires short_name on create', () => {
  const result = validateCompanyPayload(
    { business_name: 'Dynamics Corp. SpA', rut: '76123456-7' },
    { requireAll: true }
  )
  assert.equal(result.ok, false)
  assert.match(result.errors.join(' '), /Nombre comercial es obligatorio/)
})

test('validateCompanyPayload accepts short_name on create', () => {
  const result = validateCompanyPayload(validBase, { requireAll: true })
  assert.equal(result.ok, true)
  assert.equal(result.data.short_name, 'Dynamics')
})

test('validateCompanyPayload omits short_name on partial update', () => {
  const result = validateCompanyPayload({ business_name: 'Updated Name' }, { requireAll: false })
  assert.equal(result.ok, true)
  assert.equal(result.data.short_name, undefined)
})

test('validateCompanyPayload includes short_name on update when provided', () => {
  const result = validateCompanyPayload({ short_name: 'Dyn' }, { requireAll: false })
  assert.equal(result.ok, true)
  assert.equal(result.data.short_name, 'Dyn')
})
