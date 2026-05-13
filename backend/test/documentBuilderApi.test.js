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

test('GET /api/document-builder/templates returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).get('/api/document-builder/templates?companyId=c1')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('POST /api/document-builder/generate returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).post('/api/document-builder/generate?companyId=c1').send({ employeeIds: [], template: {} })
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('GET /api/document-builder/downloads/:id returns 403 when missing grant', async () => {
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden() })
  const res = await request(app).get('/api/document-builder/downloads/x1?companyId=c1')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})
