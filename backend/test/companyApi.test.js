const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { sendError } = require('../http/responses')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
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

test('GET /api/companies returns list envelope (200)', async () => {
  const companyService = {
    listCompanies: async () => ({ ok: true, data: { items: [{ id: 'c1', business_name: 'X' }] } })
  }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk(), companyService })
  const res = await request(app).get('/api/companies').query({ q: 'x' })

  assert.equal(res.statusCode, 200)
  assert.equal(Array.isArray(res.body?.data?.items), true)
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
})

test('POST /api/companies returns 403 when missing grant', async () => {
  const companyService = { createCompany: async () => ({ ok: true, status: 201, data: { id: 'c1' } }) }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantForbidden(), companyService })
  const res = await request(app).post('/api/companies').send({ business_name: 'X', rut: '11111111-1' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('POST /api/companies returns 400 when service validation fails', async () => {
  const companyService = {
    createCompany: async () => ({ ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El correo ingresado no tiene un formato válido.' })
  }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk(), companyService })
  const res = await request(app).post('/api/companies').send({ email: 'bad' })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('PUT /api/companies/:id returns 403 when service denies edit (out of scope)', async () => {
  const companyService = {
    updateCompany: async () => ({
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'No tiene permisos para editar empresas.'
    })
  }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk(), companyService })
  const res = await request(app).put('/api/companies/c99').send({ business_name: 'X' })
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
  assert.match(String(res.body?.error?.message || ''), /permisos/i)
})

test('GET /api/companies/:id returns 404 when company not in scope', async () => {
  const companyService = {
    getCompanyDetail: async () => ({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Empresa no encontrada.'
    })
  }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk(), companyService })
  const res = await request(app).get('/api/companies/unknown-id')
  assert.equal(res.statusCode, 404)
  assert.equal(res.body?.error?.code, 'NOT_FOUND')
})

test('POST /api/companies forwards payload including branches to service', async () => {
  let captured = null
  const companyService = {
    createCompany: async ({ payload }) => {
      captured = payload
      return { ok: true, status: 201, data: { id: 'c1', branches: [] } }
    }
  }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk(), companyService })
  const body = {
    business_name: 'Acme',
    rut: '11111111-1',
    email: 'a@b.cl',
    branches: [{ name: 'Suc 1', email: 's@b.cl', commune: 'X' }]
  }
  const res = await request(app).post('/api/companies').send(body)
  assert.equal(res.statusCode, 201)
  assert.equal(captured?.branches?.length, 1)
  assert.equal(captured?.branches?.[0]?.name, 'Suc 1')
})

test('PUT /api/companies/:id forwards branches on update', async () => {
  let captured = null
  const companyService = {
    updateCompany: async ({ payload }) => {
      captured = payload
      return { ok: true, data: { id: 'c1', branches: [] } }
    }
  }
  const app = createApp({ requireAuth: authOk, requireGrant: () => grantOk(), companyService })
  const res = await request(app).put('/api/companies/c1').send({ branches: [] })
  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(captured?.branches))
})

