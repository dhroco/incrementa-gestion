const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { sendError } = require('../http/responses')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

function authMissing(_req, res) {
  return sendError(res, {
    status: 401,
    code: 'AUTH_MISSING_TOKEN',
    message: 'No autorizado. Falta token de acceso.'
  })
}

function grantOk() {
  return (_req, _res, next) => next()
}

function grantForbidden() {
  return (_req, res) =>
    sendError(res, {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Acceso denegado. No tiene permisos para realizar esta acción.'
    })
}

test('GET /api/placeholder/dashboard returns envelope + meta.timestamp (200)', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk() })
  const res = await request(app).get('/api/placeholder/dashboard')

  assert.equal(res.statusCode, 200)
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
  assert.equal(Array.isArray(res.body?.data?.cards), true)
  assert.equal(typeof res.body?.data?.highlights?.title, 'string')
})

test('GET /api/placeholder/dashboard returns structured 401 when missing auth', async () => {
  const app = createApp({ requireAuth: authMissing, requireGrant: () => grantOk() })
  const res = await request(app).get('/api/placeholder/dashboard')

  assert.equal(res.statusCode, 401)
  assert.equal(res.body?.error?.code, 'AUTH_MISSING_TOKEN')
  assert.equal(typeof res.body?.error?.message, 'string')
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
})

test('GET /api/placeholder/dashboard returns structured 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).get('/api/placeholder/dashboard')

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
})

test('GET /api/placeholder/contratos/list returns items and meta.total (200)', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk() })
  const res = await request(app).get('/api/placeholder/contratos/list')

  assert.equal(res.statusCode, 200)
  assert.equal(Array.isArray(res.body?.data?.items), true)
  assert.equal(res.body?.meta?.total, 2)
  assert.equal(res.body?.meta?.module, 'contratos')
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
})

