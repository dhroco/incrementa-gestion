const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('GET /api/companies returns list envelope (200)', async () => {
  const companyService = {
    listCompanies: async () => ({
      ok: true,
      data: { items: [{ id: 'c1', business_name: 'X', short_name: 'X Short' }] }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Company']]),
    companyService
  })
  const res = await request(app).get('/api/companies').query({ q: 'x' })

  assert.equal(res.statusCode, 200)
  assert.equal(Array.isArray(res.body?.data?.items), true)
  assert.equal(res.body?.data?.items?.[0]?.short_name, 'X Short')
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
})

test('POST /api/companies returns 403 when missing grant', async () => {
  const companyService = { createCompany: async () => ({ ok: true, status: 201, data: { id: 'c1' } }) }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([]),
    companyService
  })
  const res = await request(app).post('/api/companies').send({ business_name: 'X', rut: '11111111-1' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('POST /api/companies returns 400 when service validation fails', async () => {
  const companyService = {
    createCompany: async () => ({
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El correo ingresado no tiene un formato válido.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Company']]),
    companyService
  })
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
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    companyService
  })
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
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Company']]),
    companyService
  })
  const res = await request(app).get('/api/companies/unknown-id')
  assert.equal(res.statusCode, 404)
  assert.equal(res.body?.error?.code, 'NOT_FOUND')
})

test('POST /api/companies forwards payload to service', async () => {
  let captured = null
  const companyService = {
    createCompany: async ({ payload }) => {
      captured = payload
      return { ok: true, status: 201, data: { id: 'c1', business_name: 'Acme' } }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Company']]),
    companyService
  })
  const body = {
    business_name: 'Acme',
    short_name: 'Acme Short',
    rut: '11111111-1',
    email: 'a@b.cl'
  }
  const res = await request(app).post('/api/companies').send(body)
  assert.equal(res.statusCode, 201)
  assert.equal(captured?.business_name, 'Acme')
  assert.equal(captured?.short_name, 'Acme Short')
  assert.equal(captured?.email, 'a@b.cl')
})

test('PUT /api/companies/:id forwards update payload to service', async () => {
  let captured = null
  const companyService = {
    updateCompany: async ({ payload }) => {
      captured = payload
      return { ok: true, data: { id: 'c1', business_name: 'Acme Updated' } }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    companyService
  })
  const res = await request(app).put('/api/companies/c1').send({ business_name: 'Acme Updated', short_name: 'Acme' })
  assert.equal(res.statusCode, 200)
  assert.equal(captured?.business_name, 'Acme Updated')
  assert.equal(captured?.short_name, 'Acme')
})
