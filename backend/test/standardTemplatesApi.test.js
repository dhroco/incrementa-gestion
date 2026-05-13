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

const VALID_TEMPLATE_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

const DOC_WITH_EMBEDDED = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [] },
    {
      type: 'embeddedUniversalClause',
      attrs: {
        clauseId: '00000000-0000-4000-8000-000000000001',
        instanceId: '00000000-0000-4000-8000-000000000002',
        code: 'C1',
        titleClause: 'T1',
      },
    },
  ],
}

test('GET /api/standard-templates returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [],
    }),
  })

  const res = await request(app).get('/api/standard-templates')
  assert.equal(res.statusCode, 403)
})

test('GET /api/standard-templates returns 200 with items', async () => {
  const standardTemplatesService = {
    listStandardTemplates: async () => ({
      ok: true,
      items: [
        {
          id: 't1',
          name: 'Plantilla A',
          code: 'PLANTILLA-A001',
          description: null,
          status: 'draft',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
    standardTemplatesService,
  })

  const res = await request(app).get('/api/standard-templates')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.id, 't1')
})

test('GET /api/standard-templates passes trimmed search to service when q is present', async () => {
  let receivedSearch
  const standardTemplatesService = {
    listStandardTemplates: async ({ search } = {}) => {
      receivedSearch = search
      return { ok: true, items: [] }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
    standardTemplatesService,
  })

  const res = await request(app).get('/api/standard-templates').query({ q: 'plantilla' })
  assert.equal(res.statusCode, 200)
  assert.equal(receivedSearch, 'plantilla')
  assert.equal(res.body?.data?.items?.length, 0)
})

test('GET /api/standard-templates omits search when q is absent', async () => {
  let receivedSearch = 'unset'
  const standardTemplatesService = {
    listStandardTemplates: async ({ search } = {}) => {
      receivedSearch = search
      return { ok: true, items: [{ id: 't1', name: 'A', code: 'C', description: null, status: 'draft', updated_at: null }] }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
    standardTemplatesService,
  })

  const res = await request(app).get('/api/standard-templates')
  assert.equal(res.statusCode, 200)
  assert.equal(receivedSearch, undefined)
  assert.equal(res.body?.data?.items?.length, 1)
})

test('POST /api/standard-templates returns 403 without create grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'P',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 403)
})

test('POST /api/standard-templates returns 201 when service succeeds', async () => {
  const standardTemplatesService = {
    createStandardTemplate: async (input) => {
      assert.equal(input.code, 'PLANTILLA-A001')
      assert.equal(input.actorUserProfileId, 'up1')
      return {
        ok: true,
        template: {
          id: 't-new',
          name: 'Plantilla',
          code: 'PLANTILLA-A001',
          description: null,
          status: 'draft',
          document_type_id: 'dt1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE' }],
    }),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    code: 'PLANTILLA-A001',
    content_json: DOC_WITH_EMBEDDED,
    status: 'draft',
  })
  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.id, 't-new')
})

test('POST /api/standard-templates returns 400 when code is missing', async () => {
  const standardTemplatesService = { createStandardTemplate: async () => ({ ok: true, template: {} }) }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE' }],
    }),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'TEMPLATE_INVALID_PAYLOAD')
})

test('POST /api/standard-templates returns 409 when code is duplicated', async () => {
  const standardTemplatesService = {
    createStandardTemplate: async () => ({
      ok: false,
      error: {
        type: 'unique_code',
        code: 'TEMPLATE_CODE_NOT_UNIQUE',
        message: 'Ya existe una plantilla estándar con ese código.',
      },
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE' }],
    }),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    code: 'DUP',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 409)
  assert.equal(res.body?.error?.code, 'TEMPLATE_CODE_NOT_UNIQUE')
})

test('POST /api/standard-templates returns 400 when embedded clauses invalid', async () => {
  const standardTemplatesService = {
    createStandardTemplate: async () => ({
      ok: false,
      error: {
        type: 'invalid_clauses',
        code: 'TEMPLATE_INVALID_EMBEDDED_CLAUSE',
        message: 'Una o más cláusulas incrustadas no existen o no son universales.',
      },
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE' }],
    }),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    code: 'PLANT-X',
    content_json: DOC_WITH_EMBEDDED,
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'TEMPLATE_INVALID_EMBEDDED_CLAUSE')
})

test('GET /api/standard-templates returns 401 without auth', async () => {
  const app = createApp({ requireAuth: authMissing })

  const res = await request(app).get('/api/standard-templates')
  assert.equal(res.statusCode, 401)
})

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111'

test('GET /api/standard-templates/:id returns 403 without read grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [],
    }),
  })

  const res = await request(app).get(`/api/standard-templates/${TEMPLATE_ID}`)
  assert.equal(res.statusCode, 403)
})

test('GET /api/standard-templates/:id returns 404 when not found', async () => {
  const standardTemplatesService = {
    getStandardTemplateById: async () => ({ ok: false, notFound: true }),
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
    standardTemplatesService,
  })

  const res = await request(app).get(`/api/standard-templates/${TEMPLATE_ID}`)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body?.error?.code, 'TEMPLATE_NOT_FOUND')
})

test('GET /api/standard-templates/:id returns 200 with template body', async () => {
  const standardTemplatesService = {
    getStandardTemplateById: async () => ({
      ok: true,
      template: {
        id: TEMPLATE_ID,
        name: 'P',
        code: 'PLANTILLA-A001',
        description: null,
        status: 'draft',
        document_type_id: 'dt1',
        content_json: VALID_TEMPLATE_DOC,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
    standardTemplatesService,
  })

  const res = await request(app).get(`/api/standard-templates/${TEMPLATE_ID}`)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.id, TEMPLATE_ID)
  assert.equal(res.body?.data?.content_json?.type, 'doc')
})

test('PUT /api/standard-templates/:id returns 403 without edit grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }],
    }),
  })

  const res = await request(app).put(`/api/standard-templates/${TEMPLATE_ID}`).send({
    name: 'X',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 403)
})

test('PUT /api/standard-templates/:id returns 400 when embedded clauses invalid', async () => {
  const standardTemplatesService = {
    updateStandardTemplate: async () => ({
      ok: false,
      error: {
        type: 'invalid_clauses',
        code: 'TEMPLATE_INVALID_EMBEDDED_CLAUSE',
        message: 'Una o más cláusulas incrustadas no existen o no son universales.',
      },
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT' }],
    }),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).put(`/api/standard-templates/${TEMPLATE_ID}`).send({
    name: 'Plantilla',
    code: 'PLANTILLA-A001',
    content_json: DOC_WITH_EMBEDDED,
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'TEMPLATE_INVALID_EMBEDDED_CLAUSE')
})

test('PUT /api/standard-templates/:id returns 200 when service succeeds', async () => {
  const standardTemplatesService = {
    updateStandardTemplate: async (id, input) => {
      assert.equal(id, TEMPLATE_ID)
      assert.equal(input.code, 'PLANTILLA-A001')
      assert.equal(input.actorUserProfileId, 'up1')
      return {
        ok: true,
        template: {
          id: TEMPLATE_ID,
          name: 'Plantilla',
          code: 'PLANTILLA-A001',
          description: null,
          status: 'draft',
          document_type_id: 'dt1',
          content_json: VALID_TEMPLATE_DOC,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    effectiveNavigationResolver: async () => ({
      profile: { id: 'p1', code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' },
      rows: [{ code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT' }],
    }),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).put(`/api/standard-templates/${TEMPLATE_ID}`).send({
    name: 'Plantilla',
    code: 'PLANTILLA-A001',
    content_json: VALID_TEMPLATE_DOC,
    status: 'draft',
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.id, TEMPLATE_ID)
})
