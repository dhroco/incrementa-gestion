const test = require('node:test')
const assert = require('node:assert/strict')
const { buildFullNameFromKeycloakUser } = require('../lib/keycloakAdminClient')

test('buildFullNameFromKeycloakUser joins firstName and lastName', () => {
  assert.equal(
    buildFullNameFromKeycloakUser({ firstName: 'Ana', lastName: 'Pérez' }, 'a@b.cl'),
    'Ana Pérez'
  )
})

test('buildFullNameFromKeycloakUser trims and ignores empty parts', () => {
  assert.equal(
    buildFullNameFromKeycloakUser({ firstName: '  Ana  ', lastName: '' }, 'a@b.cl'),
    'Ana'
  )
})

test('buildFullNameFromKeycloakUser falls back to email when name parts missing', () => {
  assert.equal(buildFullNameFromKeycloakUser({ firstName: '', lastName: '' }, 'a@b.cl'), 'a@b.cl')
  assert.equal(buildFullNameFromKeycloakUser({}, 'a@b.cl'), 'a@b.cl')
})
