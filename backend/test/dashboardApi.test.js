const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { sendError } = require('../http/responses')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

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

const mockStats = {
  suppliers: { total: 42, personaNatural: 10, empresa: 32 },
  contracts: { draftPending: 5, signedTotal: 18 },
  templates: { activeTotal: 7, mostRecentName: 'Contrato de servicios' }
}

const dashboardService = {
  getDashboardStats: async () => ({ ok: true, data: mockStats })
}

test('GET /api/dashboard/stats returns numeric stats (200)', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Dashboard']]),
    dashboardService
  })
  const res = await request(app).get('/api/dashboard/stats')

  assert.equal(res.statusCode, 200)
  assert.equal(typeof res.body?.meta?.timestamp, 'string')
  assert.equal(typeof res.body?.data?.suppliers?.total, 'number')
  assert.equal(typeof res.body?.data?.suppliers?.personaNatural, 'number')
  assert.equal(typeof res.body?.data?.suppliers?.empresa, 'number')
  assert.equal(typeof res.body?.data?.contracts?.draftPending, 'number')
  assert.equal(typeof res.body?.data?.contracts?.signedTotal, 'number')
  assert.equal(typeof res.body?.data?.templates?.activeTotal, 'number')
  assert.equal(res.body?.data?.templates?.mostRecentName, 'Contrato de servicios')
})

test('GET /api/dashboard/stats returns structured 401 when missing auth', async () => {
  const app = createApp({
    requireAuth: authMissing,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Dashboard']]),
    dashboardService
  })
  const res = await request(app).get('/api/dashboard/stats')

  assert.equal(res.statusCode, 401)
  assert.equal(res.body?.error?.code, 'AUTH_MISSING_TOKEN')
  assert.equal(typeof res.body?.error?.message, 'string')
})

test('GET /api/dashboard/stats returns structured 403 when missing grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([]),
    dashboardService
  })
  const res = await request(app).get('/api/dashboard/stats')

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})
