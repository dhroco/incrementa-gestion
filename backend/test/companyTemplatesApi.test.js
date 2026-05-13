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
    message: 'No autorizado. Falta token de acceso.',
  })
}

const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'

test('GET /api/company-templates returns 401 without auth', async () => {
  const app = createApp({ requireAuth: authMissing })
  const res = await request(app).get('/api/company-templates').set('X-Company-Id', COMPANY_ID)
  assert.equal(res.statusCode, 401)
})

test('GET /api/company-templates returns 403 without read grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'CONTADOR', label: 'Contador' },
      rows: [],
    }),
  })
  const res = await request(app).get('/api/company-templates').set('X-Company-Id', COMPANY_ID)
  assert.equal(res.statusCode, 403)
})

test('POST /api/company-templates returns 403 without create grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'CONTADOR', label: 'Contador' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ' }],
    }),
  })
  const res = await request(app)
    .post('/api/company-templates')
    .set('X-Company-Id', COMPANY_ID)
    .send({ name: 'P', code: 'C1', content_json: { type: 'doc', content: [{ type: 'paragraph', content: [] }] } })
  assert.equal(res.statusCode, 403)
})

test('GET /api/company-templates/:id returns 403 without read grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'CONTADOR', label: 'Contador' },
      rows: [],
    }),
  })
  const res = await request(app).get(`/api/company-templates/${TEMPLATE_ID}`).set('X-Company-Id', COMPANY_ID)
  assert.equal(res.statusCode, 403)
})

test('PUT /api/company-templates/:id returns 403 without edit grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'CONTADOR', label: 'Contador' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ' }],
    }),
  })
  const res = await request(app)
    .put(`/api/company-templates/${TEMPLATE_ID}`)
    .set('X-Company-Id', COMPANY_ID)
    .send({
      name: 'P',
      code: 'C1',
      content_json: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    })
  assert.equal(res.statusCode, 403)
})
