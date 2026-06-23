const test = require('node:test')
const assert = require('node:assert/strict')
const { resolveInternalIdentity } = require('../middleware/resolveInternalIdentity')

function createDbStub(row) {
  const chain = {
    select() {
      return chain
    },
    whereRaw(_sql, _params) {
      return chain
    },
    first: async () => row
  }
  return (table) => {
    assert.equal(table, 'user_profile')
    return chain
  }
}

test('resolveInternalIdentity overwrites userId when email matches profile', async () => {
  const middleware = resolveInternalIdentity({
    db: createDbStub({ user_id: 'internal-uuid-1' })
  })
  const req = { auth: { userId: 'external-sub', email: 'User@Example.com' } }
  let nextCalled = false

  await middleware(req, {}, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(req.auth.userId, 'internal-uuid-1')
  assert.equal(req.auth.email, 'user@example.com')
})

test('resolveInternalIdentity leaves userId unchanged when no profile match', async () => {
  const middleware = resolveInternalIdentity({
    db: createDbStub(undefined)
  })
  const req = { auth: { userId: 'external-sub', email: 'missing@example.com' } }

  await middleware(req, {}, () => {})

  assert.equal(req.auth.userId, 'external-sub')
  assert.equal(req.auth.email, 'missing@example.com')
})

test('resolveInternalIdentity skips lookup when email is absent', async () => {
  let dbCalled = false
  const middleware = resolveInternalIdentity({
    db: () => {
      dbCalled = true
      return createDbStub(undefined)
    }
  })
  const req = { auth: { userId: 'external-sub', email: null } }

  await middleware(req, {}, () => {})

  assert.equal(dbCalled, false)
  assert.equal(req.auth.userId, 'external-sub')
})

test('resolveInternalIdentity skips lookup when email normalizes to empty', async () => {
  let dbCalled = false
  const middleware = resolveInternalIdentity({
    db: () => {
      dbCalled = true
      return createDbStub(undefined)
    }
  })
  const req = { auth: { userId: 'external-sub', email: '   ' } }

  await middleware(req, {}, () => {})

  assert.equal(dbCalled, false)
  assert.equal(req.auth.userId, 'external-sub')
})
