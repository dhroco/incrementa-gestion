const test = require('node:test')
const assert = require('node:assert/strict')
const { createRequireNavigationGrant } = require('../middleware/requireNavigationGrant')

function createRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

test('requireNavigationGrant allows when navigation code is granted', async () => {
  const requireNavigationGrant = createRequireNavigationGrant({
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'X', label: 'Y' },
      rows: [{ code: 'NAV_OK' }]
    })
  })

  const req = { auth: { userId: 'u1', email: 'a@b.cl' } }
  const res = createRes()
  let calledNext = false

  await requireNavigationGrant({ navigationCode: 'NAV_OK' })(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, true)
  assert.equal(res.statusCode, null)
})

test('requireNavigationGrant denies with 403 when navigation code is not granted', async () => {
  const requireNavigationGrant = createRequireNavigationGrant({
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'X', label: 'Y' },
      rows: [{ code: 'NAV_OTHER' }]
    })
  })

  const req = { auth: { userId: 'u1', email: 'a@b.cl' } }
  const res = createRes()
  let calledNext = false

  await requireNavigationGrant({ navigationCode: 'NAV_OK' })(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error.code, 'FORBIDDEN')
})

test('requireNavigationGrant allows when one of anyOfNavigationCodes is granted', async () => {
  const requireNavigationGrant = createRequireNavigationGrant({
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'X', label: 'Y' },
      rows: [{ code: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE' }]
    })
  })

  const req = { auth: { userId: 'u1', email: 'a@b.cl' } }
  const res = createRes()
  let calledNext = false

  await requireNavigationGrant({
    anyOfNavigationCodes: [
      'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT',
      'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE'
    ]
  })(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, true)
  assert.equal(res.statusCode, null)
})

test('requireNavigationGrant denies with 403 when user has no profile assignment', async () => {
  const requireNavigationGrant = createRequireNavigationGrant({
    effectiveNavigationResolver: async () => null
  })

  const req = { auth: { userId: 'u1', email: 'a@b.cl' } }
  const res = createRes()
  let calledNext = false

  await requireNavigationGrant({ navigationCode: 'NAV_OK' })(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error.code, 'PROFILE_NOT_ASSIGNED')
})

