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

function authMissing(_req, res) {
  return sendError(res, {
    status: 401,
    code: 'AUTH_MISSING_TOKEN',
    message: 'No autorizado. Falta token de acceso.',
  })
}

/** Minimal TipTap doc that passes validateClauseContentJson (non-empty content array). */
const VALID_CLAUSE_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

function makeClause({ id = 'c1', type = 'universal', company_id = null, code = 'X' } = {}) {
  return {
    id,
    type,
    company_id,
    title_clause: 'Titulo',
    code,
    description: null,
    content_json: VALID_CLAUSE_DOC,
    status: 'draft',
    created_by: 'up1',
    updated_by: 'up1',
    last_edited_by: 'up1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

test('POST /api/clauses/universal returns 201 (envelope)', async () => {
  const clauseService = {
    createUniversal: async () => ({ ok: true, clause: makeClause({ id: 'u1', type: 'universal', code: 'A' }) }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/clauses/universal').send({
    title_clause: 'Cláusula 1',
    code: 'A',
    description: '',
    content_json: VALID_CLAUSE_DOC,
  })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.id, 'u1')
  assert.equal(res.body?.data?.type, 'universal')
})

test('POST /api/clauses/universal returns 409 when code duplicated', async () => {
  const clauseService = {
    createUniversal: async () => ({ ok: false, error: { type: 'unique', context: 'universal' } }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/clauses/universal').send({
    title_clause: 'Cláusula 1',
    code: 'A',
    content_json: VALID_CLAUSE_DOC,
  })

  assert.equal(res.statusCode, 409)
  assert.equal(res.body?.error?.code, 'CLAUSE_CODE_NOT_UNIQUE')
})

test('POST /api/clauses/universal returns 400 when content_json is empty doc', async () => {
  const clauseService = { createUniversal: async () => ({ ok: true, clause: makeClause() }) }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/clauses/universal').send({
    title_clause: 'Cláusula 1',
    code: 'A',
    content_json: { type: 'doc', content: [] },
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'CLAUSE_EMPTY_CONTENT')
})

test('POST /api/clauses/universal returns 400 when content_json is missing', async () => {
  const clauseService = { createUniversal: async () => ({ ok: true, clause: makeClause() }) }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/clauses/universal').send({
    title_clause: 'Cláusula 1',
    code: 'A',
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'CLAUSE_CONTENT_JSON_REQUIRED')
})

test('POST /api/clauses/company returns 201 (envelope)', async () => {
  const clauseService = {
    createCompany: async () =>
      ({ ok: true, clause: makeClause({ id: 'c1', type: 'company', company_id: 'co1', code: 'B' }) }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: []
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
    // Bypass DB company scope resolver in tests.
    companyScopeResolver: async () => ({ profileCode: 'USUARIO_EMPRESA_ADMINISTRADOR', userProfileId: 'up1', mode: 'single', companyId: 'co1' }),
  })

  const res = await request(app).post('/api/clauses/company').send({
    title_clause: 'Cláusula empresa',
    code: 'B',
    content_json: VALID_CLAUSE_DOC,
  })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.type, 'company')
  assert.equal(res.body?.data?.company_id, 'co1')
})

test('POST /api/clauses/company returns 409 when code duplicated in same company', async () => {
  const clauseService = {
    createCompany: async () => ({ ok: false, error: { type: 'unique', context: 'company' } }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: []
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
    companyScopeResolver: async () => ({ profileCode: 'USUARIO_EMPRESA_ADMINISTRADOR', userProfileId: 'up1', mode: 'single', companyId: 'co1' }),
  })

  const res = await request(app).post('/api/clauses/company').send({
    title_clause: 'Cláusula empresa',
    code: 'B',
    content_json: VALID_CLAUSE_DOC,
  })

  assert.equal(res.statusCode, 409)
  assert.equal(res.body?.error?.code, 'CLAUSE_CODE_NOT_UNIQUE')
  assert.match(String(res.body?.error?.message || ''), /esta empresa/i)
})

test('GET /api/clauses/:id returns 200 and envelope', async () => {
  const clauseService = {
    getClauseDetail: async () => makeClause({ id: 'u1', type: 'universal', code: 'A' }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ' }]
    }),
    clauseService
  })

  const res = await request(app).get('/api/clauses/u1')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.id, 'u1')
})

test('GET /api/clauses/:id returns 404 when missing', async () => {
  const clauseService = { getClauseDetail: async () => null }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ' }]
    }),
    clauseService
  })

  const res = await request(app).get('/api/clauses/missing')
  assert.equal(res.statusCode, 404)
  assert.equal(res.body?.error?.code, 'CLAUSE_NOT_FOUND')
})

test('GET /api/clauses/:id returns 403 without leaking clause payload when read grant missing', async () => {
  const clauseService = {
    getClauseDetail: async () => makeClause({ id: 'u1', type: 'universal', code: 'SECRET' }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: []
    }),
    clauseService
  })

  const res = await request(app).get('/api/clauses/u1')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.data, undefined)
  assert.ok(!JSON.stringify(res.body || {}).includes('SECRET'))
})

test('PUT /api/clauses/:id returns 200 when updated', async () => {
  const clauseService = {
    updateClause: async () => ({ ok: true, clause: makeClause({ id: 'u1', type: 'universal', code: 'A2' }) }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).put('/api/clauses/u1').send({ code: 'A2' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.code, 'A2')
})

test('PUT /api/clauses/:id returns 400 when empty payload', async () => {
  const clauseService = { updateClause: async () => ({ ok: true, clause: makeClause() }) }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).put('/api/clauses/u1').send({})
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'CLAUSE_INVALID_PAYLOAD')
})

test('PUT /api/clauses/:id returns 409 when code duplicated', async () => {
  const clauseService = {
    updateClause: async () => ({ ok: false, error: { type: 'unique', context: 'company' } }),
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).put('/api/clauses/u1').send({ code: 'DUP' })
  assert.equal(res.statusCode, 409)
  assert.equal(res.body?.error?.code, 'CLAUSE_CODE_NOT_UNIQUE')
  assert.match(String(res.body?.error?.message || ''), /esta empresa/i)
})

test('POST /api/clauses/universal returns 403 when user has no user_profile', async () => {
  const clauseService = { createUniversal: async () => ({ ok: true, clause: makeClause() }) }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE' }]
    }),
    clauseService,
    userProfileIdResolver: async () => null
  })

  const res = await request(app).post('/api/clauses/universal').send({
    title_clause: 'Cláusula',
    code: 'X',
    content_json: VALID_CLAUSE_DOC,
  })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'PROFILE_NOT_ASSIGNED')
})

test('POST /api/clauses/universal returns 401 when missing auth', async () => {
  const clauseService = { createUniversal: async () => ({ ok: true, clause: makeClause() }) }
  const app = createApp({
    requireAuth: authMissing,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => null,
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).post('/api/clauses/universal').send({
    title_clause: 'Cláusula',
    code: 'X',
    content_json: VALID_CLAUSE_DOC,
  })

  assert.equal(res.statusCode, 401)
  assert.equal(res.body?.error?.code, 'AUTH_MISSING_TOKEN')
})

test('PUT /api/clauses/:id returns 400 when content_json is empty', async () => {
  const clauseService = { updateClause: async () => ({ ok: true, clause: makeClause() }) }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).put('/api/clauses/u1').send({ content_json: { type: 'doc', content: [] } })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'CLAUSE_EMPTY_CONTENT')
})

test('GET /api/clauses/universal returns list envelope', async () => {
  const clauseService = {
    listUniversal: async ({ search }) => {
      assert.equal(search, 'x')
      return [
        {
          id: 'u1',
          title_clause: 'T',
          code: 'C1',
          description: null,
          status: 'draft',
          updated_at: '2026-01-01T00:00:00.000Z',
          last_edited_by_name: 'Ana Pérez',
        },
      ]
    },
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).get('/api/clauses/universal').query({ q: 'x' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.code, 'C1')
  assert.equal(res.body?.data?.items?.[0]?.last_edited_by_name, 'Ana Pérez')
  assert.equal(res.body?.meta?.total, 1)
})

test('GET /api/clauses/company returns list envelope for single scope', async () => {
  const clauseService = {
    listCompanyInScope: async ({ scope, search, activeCompanyId }) => {
      assert.equal(search, 'abc')
      assert.equal(scope?.mode, 'single')
      assert.equal(scope?.companyId, 'co1')
      assert.equal(activeCompanyId, undefined)
      return [
        {
          id: 'c1',
          company_id: 'co1',
          company_business_name: 'Empresa Demo Uno SpA',
          title_clause: 'T',
          code: 'C1',
          description: null,
          status: 'draft',
          updated_at: '2026-01-01T00:00:00.000Z',
          last_edited_by_name: 'Luis Torres',
        },
      ]
    },
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    clauseService,
    companyScopeResolver: async () => ({
      profileCode: 'USUARIO_EMPRESA_ADMINISTRADOR',
      userProfileId: 'up1',
      mode: 'single',
      companyId: 'co1',
    }),
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).get('/api/clauses/company').query({ q: 'abc' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.company_id, 'co1')
  assert.equal(res.body?.data?.items?.[0]?.last_edited_by_name, 'Luis Torres')
  assert.equal(res.body?.meta?.total, 1)
})

test('GET /api/clauses/company returns 403 when missing scope', async () => {
  const clauseService = { listCompanyInScope: async () => [{ id: 'c1', company_id: 'co1' }] }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    clauseService,
    companyScopeResolver: async () => null,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).get('/api/clauses/company')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('GET /api/clauses/company returns 403 for platform admin', async () => {
  const clauseService = { listCompanyInScope: async () => [{ id: 'c1', company_id: 'co1' }] }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    clauseService,
    companyScopeResolver: async () => ({ profileCode: 'ADMINISTRADOR_PLATAFORMA', userProfileId: 'up1', mode: 'all' }),
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).get('/api/clauses/company')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('GET /api/clauses/company returns 400 for CONTADOR scope without X-Company-Id', async () => {
  const clauseService = { listCompanyInScope: async () => [] }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    clauseService,
    companyScopeResolver: async () => ({
      profileCode: 'CONTADOR',
      userProfileId: 'up1',
      mode: 'set',
      companyIds: ['co1', 'co2']
    }),
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).get('/api/clauses/company')
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'COMPANY_CONTEXT_REQUIRED')
})

test('GET /api/clauses/company returns 403 when X-Company-Id is not assigned to CONTADOR', async () => {
  const clauseService = { listCompanyInScope: async () => [] }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    clauseService,
    companyScopeResolver: async () => ({
      profileCode: 'CONTADOR',
      userProfileId: 'up1',
      mode: 'set',
      companyIds: ['co1']
    }),
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).get('/api/clauses/company').set('X-Company-Id', 'co99')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.code, 'FORBIDDEN')
})

test('GET /api/clauses/company returns list envelope for CONTADOR with X-Company-Id', async () => {
  const clauseService = {
    listCompanyInScope: async ({ scope, search, activeCompanyId }) => {
      assert.equal(scope?.mode, 'set')
      assert.equal(activeCompanyId, 'co1')
      assert.equal(search, '')
      return [{ id: 'c1', company_id: 'co1', title_clause: 'T', code: 'X' }]
    }
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    clauseService,
    companyScopeResolver: async () => ({
      profileCode: 'CONTADOR',
      userProfileId: 'up1',
      mode: 'set',
      companyIds: ['co1', 'co2']
    }),
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).get('/api/clauses/company').set('X-Company-Id', 'co1')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
})

test('POST /api/clauses/company returns 201 for CONTADOR with X-Company-Id', async () => {
  const clauseService = {
    createCompany: async ({ company_id }) => {
      assert.equal(company_id, 'co1')
      return { ok: true, clause: makeClause({ id: 'c1', type: 'company', company_id: 'co1', code: 'B' }) }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { code: 'CONTADOR', label: 'Contador' },
      rows: []
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
    companyScopeResolver: async () => ({
      profileCode: 'CONTADOR',
      userProfileId: 'up1',
      mode: 'set',
      companyIds: ['co1', 'co2']
    })
  })

  const res = await request(app)
    .post('/api/clauses/company')
    .set('X-Company-Id', 'co1')
    .send({
      title_clause: 'Cláusula empresa',
      code: 'B',
      content_json: VALID_CLAUSE_DOC
    })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.company_id, 'co1')
})

test('POST /api/clauses/company returns 400 for CONTADOR without X-Company-Id', async () => {
  const clauseService = {
    createCompany: async () => ({ ok: true, clause: makeClause({ type: 'company', company_id: 'co1' }) })
  }
  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { code: 'CONTADOR', label: 'Contador' },
      rows: []
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1',
    companyScopeResolver: async () => ({
      profileCode: 'CONTADOR',
      userProfileId: 'up1',
      mode: 'set',
      companyIds: ['co1']
    })
  })

  const res = await request(app).post('/api/clauses/company').send({
    title_clause: 'Cláusula empresa',
    code: 'B',
    content_json: VALID_CLAUSE_DOC
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'COMPANY_CONTEXT_REQUIRED')
})

test('POST /api/clauses/resolve-read returns partial results per item', async () => {
  let calls = 0
  const clauseService = {
    getClauseDetail: async (id) => {
      calls += 1
      if (id === 'u1') return makeClause({ id: 'u1', type: 'universal', code: 'A' })
      return null
    }
  }

  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app)
    .post('/api/clauses/resolve-read')
    .send({
      items: [
        { clause_id: 'u1', clause_kind: 'universal' },
        { clause_id: 'missing', clause_kind: 'universal' }
      ]
    })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 2)
  const okItem = res.body.data.items.find((x) => x.clause_id === 'u1')
  const missingItem = res.body.data.items.find((x) => x.clause_id === 'missing')
  assert.equal(okItem?.ok, true)
  assert.ok(okItem?.clause?.content_json)
  assert.equal(missingItem?.ok, false)
  assert.equal(missingItem?.httpStatus, 404)
  assert.equal(calls, 2)
})

test('POST /api/clauses/resolve-read dedupes repeated ids (single getClauseDetail call)', async () => {
  let calls = 0
  const clauseService = {
    getClauseDetail: async (id) => {
      calls += 1
      if (id === 'u1') return makeClause({ id: 'u1', type: 'universal', code: 'A' })
      return null
    }
  }

  const app = createApp({
    requireAuth: authOk,
    requireGrant: () => grantOk(),
    effectiveNavigationResolver: async () => ({
      profile: { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ' }]
    }),
    clauseService,
    userProfileIdResolver: async () => 'up1'
  })

  const res = await request(app).post('/api/clauses/resolve-read').send({
    items: [
      { clause_id: 'u1', clause_kind: 'universal' },
      { clause_id: 'u1', clause_kind: 'universal' }
    ]
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body.data.items[0]?.ok, true)
  assert.equal(calls, 1)
})

