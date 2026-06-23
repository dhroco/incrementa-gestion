const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildNoProfileAssignedBody,
  buildForbiddenBody,
  buildEnrichedSessionSuccessBody
} = require('../sessionResponses')

test('buildNoProfileAssignedBody includes code, message, userId, email', () => {
  const body = buildNoProfileAssignedBody('u1', 'a@b.cl')
  assert.equal(body.code, 'PROFILE_NOT_ASSIGNED')
  assert.equal(typeof body.message, 'string')
  assert.equal(body.userId, 'u1')
  assert.equal(body.email, 'a@b.cl')
})

test('buildEnrichedSessionSuccessBody includes userId, email, profile', () => {
  const body = buildEnrichedSessionSuccessBody('u1', null, { code: 'X', label: 'Y' })
  assert.equal(body.userId, 'u1')
  assert.equal(body.email, null)
  assert.deepEqual(body.profile, { code: 'X', label: 'Y' })
  assert.equal('navigation' in body, false)
  assert.equal('permissions' in body, false)
})

test('buildEnrichedSessionSuccessBody includes permissions when provided', () => {
  const permissions = [{ action: 'manage', subject: 'all' }]
  const body = buildEnrichedSessionSuccessBody('u1', 'a@b.cl', { code: 'X', label: 'Y' }, permissions)
  assert.deepEqual(body.permissions, permissions)
})

test('buildEnrichedSessionSuccessBody includes session meta flags when provided', () => {
  const permissions = [{ action: 'read', subject: 'Company' }]
  const body = buildEnrichedSessionSuccessBody(
    'u1',
    'a@b.cl',
    { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador' },
    permissions,
    { isActive: true }
  )
  assert.equal('mustChangePassword' in body, false)
  assert.equal(body.isActive, true)
})

test('buildEnrichedSessionSuccessBody includes name when displayName is non-empty', () => {
  const body = buildEnrichedSessionSuccessBody('u1', 'a@b.cl', { code: 'X', label: 'Y' }, [], null, 'María López')
  assert.equal(body.name, 'María López')
})

test('buildEnrichedSessionSuccessBody includes profile extras when provided', () => {
  const body = buildEnrichedSessionSuccessBody(
    'u1',
    'login@example.com',
    { code: 'X', label: 'Y' },
    [],
    {
      isActive: true,
      contactEmail: 'contacto@empresa.cl',
      widgetPreferences: { suppliers: true, contracts: false, templates: true },
      avatarUrl: 'https://storage.example/avatar.jpg'
    }
  )
  assert.equal(body.contact_email, 'contacto@empresa.cl')
  assert.deepEqual(body.widget_preferences, { suppliers: true, contracts: false, templates: true })
  assert.equal(body.avatar_url, 'https://storage.example/avatar.jpg')
  assert.equal('avatar_gcs_path' in body, false)
})

test('buildForbiddenBody includes code and message', () => {
  const body = buildForbiddenBody()
  assert.equal(body.code, 'FORBIDDEN')
  assert.equal(typeof body.message, 'string')
})
