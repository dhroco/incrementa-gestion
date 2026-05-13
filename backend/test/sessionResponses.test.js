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
})

test('buildEnrichedSessionSuccessBody includes navigation when provided', () => {
  const nav = { tree: [{ code: 'N1' }], routes: [{ routePath: '/app/a' }] }
  const body = buildEnrichedSessionSuccessBody('u1', 'a@b.cl', { code: 'X', label: 'Y' }, nav)
  assert.deepEqual(body.navigation, nav)
})

test('buildEnrichedSessionSuccessBody includes session meta flags when provided', () => {
  const nav = { tree: [], routes: [] }
  const body = buildEnrichedSessionSuccessBody(
    'u1',
    'a@b.cl',
    { code: 'CONTADOR', label: 'Contador' },
    nav,
    { mustChangePassword: true, isActive: true }
  )
  assert.equal(body.mustChangePassword, true)
  assert.equal(body.isActive, true)
})

test('buildEnrichedSessionSuccessBody includes name when displayName is non-empty', () => {
  const body = buildEnrichedSessionSuccessBody('u1', 'a@b.cl', { code: 'X', label: 'Y' }, null, null, 'María López')
  assert.equal(body.name, 'María López')
})

test('buildForbiddenBody includes code and message', () => {
  const body = buildForbiddenBody()
  assert.equal(body.code, 'FORBIDDEN')
  assert.equal(typeof body.message, 'string')
})
