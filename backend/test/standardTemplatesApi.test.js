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

const { attachAbilityWithRules } = require('./testAbilityHelpers')

const VALID_TEMPLATE_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

test('GET /api/standard-templates returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([]),
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
          status: 'inactive',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
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
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
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
      return { ok: true, items: [{ id: 't1', name: 'A', code: 'C', description: null, status: 'inactive', updated_at: null }] }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
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
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
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
      assert.equal(input.supplier_type, 'empresa')
      assert.equal(input.actorUserProfileId, 'up1')
      return {
        ok: true,
        template: {
          id: 't-new',
          name: 'Plantilla',
          code: 'PLANTILLA-A001',
          description: null,
          status: 'inactive',
          document_type_id: 'dt1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Template']]),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    code: 'PLANTILLA-A001',
    supplier_type: 'empresa',
    content_json: VALID_TEMPLATE_DOC,
    status: 'inactive',
  })
  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.id, 't-new')
})

test('POST /api/standard-templates returns 400 when supplier_type is missing', async () => {
  const standardTemplatesService = { createStandardTemplate: async () => ({ ok: true, template: {} }) }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Template']]),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    code: 'PLANTILLA-A001',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'TEMPLATE_INVALID_SUPPLIER_TYPE')
})

test('GET /api/standard-templates passes supplier_type filter to service', async () => {
  let receivedSupplierType
  const standardTemplatesService = {
    listStandardTemplates: async ({ supplier_type } = {}) => {
      receivedSupplierType = supplier_type
      return { ok: true, items: [{ id: 't1', name: 'A', code: 'C', supplier_type: 'persona_natural', description: null, status: 'inactive', updated_at: null }] }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
    standardTemplatesService,
  })

  const res = await request(app).get('/api/standard-templates').query({ supplier_type: 'persona_natural' })
  assert.equal(res.statusCode, 200)
  assert.equal(receivedSupplierType, 'persona_natural')
  assert.equal(res.body?.data?.items?.[0]?.supplier_type, 'persona_natural')
})

test('GET /api/standard-templates returns 400 for invalid supplier_type', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
    standardTemplatesService: { listStandardTemplates: async () => ({ ok: true, items: [] }) },
  })

  const res = await request(app).get('/api/standard-templates').query({ supplier_type: 'invalid' })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'TEMPLATE_INVALID_SUPPLIER_TYPE')
})

test('POST /api/standard-templates returns 400 when code is missing', async () => {
  const standardTemplatesService = { createStandardTemplate: async () => ({ ok: true, template: {} }) }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Template']]),
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
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Template']]),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).post('/api/standard-templates').send({
    name: 'Plantilla',
    code: 'DUP',
    supplier_type: 'empresa',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 409)
  assert.equal(res.body?.error?.code, 'TEMPLATE_CODE_NOT_UNIQUE')
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
    attachAbilityMiddleware: attachAbilityWithRules([]),
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
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
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
        status: 'inactive',
        document_type_id: 'dt1',
        content_json: VALID_TEMPLATE_DOC,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    }),
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
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
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Template']]),
  })

  const res = await request(app).put(`/api/standard-templates/${TEMPLATE_ID}`).send({
    name: 'X',
    content_json: VALID_TEMPLATE_DOC,
  })
  assert.equal(res.statusCode, 403)
})

test('PUT /api/standard-templates/:id returns 200 when service succeeds', async () => {
  const standardTemplatesService = {
    updateStandardTemplate: async (id, input) => {
      assert.equal(id, TEMPLATE_ID)
      assert.equal(input.code, 'PLANTILLA-A001')
      assert.equal(input.supplier_type, 'persona_natural')
      assert.equal(input.actorUserProfileId, 'up1')
      return {
        ok: true,
        template: {
          id: TEMPLATE_ID,
          name: 'Plantilla',
          code: 'PLANTILLA-A001',
          description: null,
          status: 'inactive',
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
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Template']]),
    standardTemplatesService,
    userProfileIdResolver: async () => 'up1',
  })

  const res = await request(app).put(`/api/standard-templates/${TEMPLATE_ID}`).send({
    name: 'Plantilla',
    code: 'PLANTILLA-A001',
    supplier_type: 'persona_natural',
    content_json: VALID_TEMPLATE_DOC,
    status: 'inactive',
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.id, TEMPLATE_ID)
})
