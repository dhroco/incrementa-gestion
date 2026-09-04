const test = require('node:test')
const assert = require('node:assert/strict')
const {
  SEED_IDENTITY_DOCUMENT_TYPES,
  validateIdentityDocument,
  formatDocumentDisplay,
  normalizeCountryCode,
  compactSearchTerm,
  resolveDocumentType,
  countryLabel
} = require('../utils/identityDocument')

const RUT = SEED_IDENTITY_DOCUMENT_TYPES.find((t) => t.code === 'RUT')
const RFC = SEED_IDENTITY_DOCUMENT_TYPES.find((t) => t.code === 'RFC')

test('rut_cl reuses parseRut and stores canonical cuerpo-DV', () => {
  const r = validateIdentityDocument({
    value: '12.345.678-5',
    documentType: RUT,
    role: 'persona_natural'
  })
  assert.equal(r.ok, true)
  assert.equal(r.canonical, '12345678-5')
  assert.equal(r.display, '12.345.678-5')
})

test('rut_cl rejects invalid RUT with the existing message and no echo', () => {
  const r = validateIdentityDocument({
    value: '123',
    documentType: RUT,
    role: 'persona_natural'
  })
  assert.equal(r.ok, false)
  assert.equal(r.message, 'El RUT ingresado no es válido.')
  assert.equal(String(r.message).includes('123'), false)
})

test('RFC persona natural accepts LEGF870121MGA and uppercases', () => {
  const r = validateIdentityDocument({
    value: 'legf870121mga',
    documentType: RFC,
    role: 'persona_natural'
  })
  assert.equal(r.ok, true)
  assert.equal(r.canonical, 'LEGF870121MGA')
  assert.equal(r.display, 'LEGF870121MGA')
})

test('RFC persona natural rejects 12-character value without echoing', () => {
  const r = validateIdentityDocument({
    value: 'LEG870121MGA',
    documentType: RFC,
    role: 'persona_natural'
  })
  assert.equal(r.ok, false)
  assert.match(r.message, /RFC ingresado no es válido/)
  assert.equal(r.message.includes('LEG870121MGA'), false)
})

test('RFC empresa accepts 12-character moral RFC', () => {
  const r = validateIdentityDocument({
    value: 'ABC010203AB1',
    documentType: RFC,
    role: 'empresa'
  })
  assert.equal(r.ok, true)
  assert.equal(r.canonical, 'ABC010203AB1')
})

test('RFC representative of an empresa validates as persona_natural (13 chars)', () => {
  const company = validateIdentityDocument({
    value: 'ABC010203AB1',
    documentType: RFC,
    role: 'empresa'
  })
  const rep = validateIdentityDocument({
    value: 'LEGF870121MGA',
    documentType: RFC,
    role: 'persona_natural',
    required: false
  })
  assert.equal(company.ok, true)
  assert.equal(rep.ok, true)
})

test('I3: a new pattern type validates without adding a registry function', () => {
  const cuit = {
    code: 'CUIT',
    country_code: 'AR',
    label: 'CUIT',
    validator_key: 'pattern',
    pattern: '^\\d{11}$'
  }
  const ok = validateIdentityDocument({
    value: '20123456789',
    documentType: cuit,
    role: 'persona_natural'
  })
  const bad = validateIdentityDocument({
    value: '2012345678',
    documentType: cuit,
    role: 'persona_natural'
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.canonical, '20123456789')
  assert.equal(bad.ok, false)
  assert.equal(bad.message.includes('2012345678'), false)
})

test('formatDocumentDisplay dots a Chilean canonical RUT', () => {
  assert.equal(formatDocumentDisplay(RUT, '12345678-5'), '12.345.678-5')
  assert.equal(formatDocumentDisplay(RFC, 'LEGF870121MGA'), 'LEGF870121MGA')
})

test('normalizeCountryCode uppercases and rejects junk', () => {
  assert.equal(normalizeCountryCode('cl').value, 'CL')
  assert.equal(normalizeCountryCode('').ok, false)
  assert.equal(normalizeCountryCode('CHL').ok, false)
})

test('compactSearchTerm strips punctuation for list search', () => {
  assert.equal(compactSearchTerm('12.345.678-5'), '123456785')
  assert.equal(compactSearchTerm('LEGF 870121'), 'LEGF870121')
})

test('resolveDocumentType infers the unique type for a country', () => {
  const r = resolveDocumentType({
    documentTypes: SEED_IDENTITY_DOCUMENT_TYPES,
    countryCode: 'MX'
  })
  assert.equal(r.ok, true)
  assert.equal(r.documentType.code, 'RFC')
})

test('countryLabel uses Spanish names for CL and MX', () => {
  assert.equal(countryLabel('CL'), 'Chile')
  assert.equal(countryLabel('MX'), 'México')
})
