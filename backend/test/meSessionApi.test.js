const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')

function authStub(req, _res, next) {
  req.auth = { userId: 'user-1', email: 'user@example.com' }
  next()
}

async function sessionMetaStub(_userId, profileCode) {
  return {
    mustChangePassword: false,
    accountantIsActive: profileCode === 'CONTADOR' ? true : null
  }
}

test('GET /api/me/session includes company context for USUARIO_EMPRESA_ADMINISTRADOR', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'USUARIO_EMPRESA_ADMINISTRADOR', label: 'Usuario Empresa Administrador' },
    rows: [],
  })
  const companyContextResolver = async () => ({ id: 'co1', business_name: 'Empresa Demo Uno SpA' })

  const app = createApp({
    requireAuth: authStub,
    effectiveNavigationResolver,
    companyContextResolver,
    sessionMetaResolver: sessionMetaStub
  })
  const res = await request(app).get('/api/me/session').expect(200)

  assert.equal(res.body?.profile?.code, 'USUARIO_EMPRESA_ADMINISTRADOR')
  assert.deepEqual(res.body?.company, { id: 'co1', business_name: 'Empresa Demo Uno SpA' })
})

test('GET /api/me/session does not include company for other profiles', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
    rows: [],
  })

  const app = createApp({ requireAuth: authStub, effectiveNavigationResolver, sessionMetaResolver: sessionMetaStub })
  const res = await request(app).get('/api/me/session').expect(200)

  assert.equal(res.body?.profile?.code, 'ADMINISTRADOR_PLATAFORMA')
  assert.equal('company' in res.body, false)
})

test('GET /api/me/session includes mustChangePassword and isActive for CONTADOR', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'CONTADOR', label: 'Contador' },
    rows: [{ id: 'n1', parent_id: null, code: 'NAV_X', label: 'X', route_path: '/app/dashboard', module_title: 'X', sort_order: 1, show_in_main_menu: true }]
  })
  const app = createApp({
    requireAuth: authStub,
    effectiveNavigationResolver,
    sessionMetaResolver: async () => ({ mustChangePassword: true, accountantIsActive: true }),
    accountantAssignedCompaniesLoader: async () => []
  })
  const res = await request(app).get('/api/me/session').expect(200)
  assert.equal(res.body?.mustChangePassword, true)
  assert.equal(res.body?.isActive, true)
})

test('GET /api/me/session includes assignedCompanies for CONTADOR when loader returns rows', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'CONTADOR', label: 'Contador' },
    rows: []
  })
  const accountantAssignedCompaniesLoader = async () => [
    { id: 'co1', business_name: 'Alpha SpA' },
    { id: 'co2', business_name: 'Beta Ltda.' }
  ]
  const app = createApp({
    requireAuth: authStub,
    effectiveNavigationResolver,
    sessionMetaResolver: sessionMetaStub,
    accountantAssignedCompaniesLoader
  })
  const res = await request(app).get('/api/me/session').expect(200)
  assert.equal(res.body?.profile?.code, 'CONTADOR')
  assert.equal(Array.isArray(res.body?.assignedCompanies), true)
  assert.equal(res.body?.assignedCompanies?.length, 2)
  assert.equal(res.body?.assignedCompanies?.[0]?.id, 'co1')
})

test('GET /api/me/session returns 403 for inactive CONTADOR', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'CONTADOR', label: 'Contador' },
    rows: []
  })
  const app = createApp({
    requireAuth: authStub,
    effectiveNavigationResolver,
    sessionMetaResolver: async () => ({ mustChangePassword: false, accountantIsActive: false })
  })
  const res = await request(app).get('/api/me/session').expect(403)
  assert.equal(res.body?.code, 'ACCOUNTANT_INACTIVE')
})

