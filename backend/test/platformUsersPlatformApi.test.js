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

test('POST /api/platform/users returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app)
    .post('/api/platform/users')
    .send({ email: 'a@b.cl', full_name: 'Nombre', profile_code: 'ADMINISTRADOR_PLATAFORMA' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('GET /api/platform/users returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).get('/api/platform/users')

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})
