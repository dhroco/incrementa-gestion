const test = require('node:test')
const assert = require('node:assert/strict')
const { validateClauseStatusChange } = require('../services/clauseStatusService')

test('validateClauseStatusChange rejects invalid status value', async () => {
  const res = await validateClauseStatusChange({
    fromStatus: 'draft',
    toStatusInput: 'nope',
    isInUseByActiveTemplate: async () => false,
  })
  assert.equal(res.ok, false)
  assert.equal(res.httpStatus, 400)
  assert.equal(res.code, 'CLAUSE_INVALID_STATUS')
})

test('validateClauseStatusChange allows draft -> active', async () => {
  const res = await validateClauseStatusChange({
    fromStatus: 'draft',
    toStatusInput: 'active',
    isInUseByActiveTemplate: async () => false,
  })
  assert.equal(res.ok, true)
  assert.equal(res.toStatus, 'active')
})

test('validateClauseStatusChange blocks draft -> inactive', async () => {
  const res = await validateClauseStatusChange({
    fromStatus: 'draft',
    toStatusInput: 'inactive',
    isInUseByActiveTemplate: async () => false,
  })
  assert.equal(res.ok, false)
  assert.equal(res.httpStatus, 409)
  assert.equal(res.code, 'INVALID_STATUS_TRANSITION')
})

test('validateClauseStatusChange blocks active -> inactive when in use by active template', async () => {
  const res = await validateClauseStatusChange({
    fromStatus: 'active',
    toStatusInput: 'inactive',
    isInUseByActiveTemplate: async () => true,
  })
  assert.equal(res.ok, false)
  assert.equal(res.httpStatus, 409)
  assert.equal(res.code, 'CLAUSE_IN_USE_BY_ACTIVE_TEMPLATE')
})

