const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { sendError } = require('../http/responses')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

function grantForbidden() {
  return (_req, res) =>
    sendError(res, {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Acceso denegado. No tiene permisos para realizar esta acción.'
    })
}

test('GET /api/company-internal-users returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).get('/api/company-internal-users?companyId=c1')

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('GET /api/company-internal-users/:id returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).get('/api/company-internal-users/p1?companyId=c1')

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('POST /api/company-internal-users returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).post('/api/company-internal-users?companyId=c1').send({ email: 'x@y.cl', full_name: 'X' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('PUT /api/company-internal-users/:id returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).put('/api/company-internal-users/p1?companyId=c1').send({ full_name: 'Y' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})
