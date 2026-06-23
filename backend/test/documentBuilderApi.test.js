const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('GET /api/document-builder/templates returns 403 when missing grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })
  const res = await request(app).get('/api/document-builder/templates?companyId=c1')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('POST /api/document-builder/generate returns 403 when missing grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })
  const res = await request(app)
    .post('/api/document-builder/generate?companyId=c1')
    .send({ supplierId: '', template: {} })
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('GET /api/document-builder/downloads/:id returns 403 when missing grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })
  const res = await request(app).get('/api/document-builder/downloads/x1?companyId=c1')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('GET /api/document-builder/downloads/:id serves inline PDF', async () => {
  const documentBuilderService = {
    getGeneratedDocumentForDownload: async () => ({
      ok: true,
      data: { file_name: 'contrato.pdf', buffer: Buffer.from('%PDF-1.4 test') }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['use', 'DocumentBuilder']]),
    documentBuilderService
  })
  const res = await request(app).get('/api/document-builder/downloads/x1?companyId=c1')
  assert.equal(res.statusCode, 200)
  assert.match(String(res.headers['content-disposition'] || ''), /^inline;/)
  assert.equal(res.headers['content-type'], 'application/pdf')
})

test('POST /api/document-builder/generate returns 200 duplicateDraft payload when draft exists', async () => {
  const existing = {
    id: 'd1',
    file_name: 'prev.pdf',
    created_at: '2026-05-15T12:00:00.000Z',
    status: 'draft'
  }
  const documentBuilderService = {
    generateAndPersist: async () => ({
      ok: false,
      status: 409,
      code: 'DUPLICATE_DRAFT',
      message: 'Ya existe un contrato generado para este proveedor con esta plantilla en el mismo mes.',
      data: { existing }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['use', 'DocumentBuilder']]),
    documentBuilderService
  })
  const res = await request(app)
    .post('/api/document-builder/generate?companyId=c1')
    .send({ supplierId: 's1', template: { kind: 'standard', id: 't1' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.duplicateDraft, true)
  assert.deepEqual(res.body?.data?.existing, existing)
})

test('POST /api/document-builder/generate returns 422 with meta.missingFields', async () => {
  const missingFields = [
    { key: 'lugar_contrato', label: 'Lugar del contrato', type: 'text' },
    { key: 'fecha_contrato', label: 'Fecha del contrato', type: 'date' }
  ]
  const documentBuilderService = {
    generateAndPersist: async () => ({
      ok: false,
      status: 422,
      code: 'MISSING_PLACEHOLDERS',
      message: 'Faltan variables requeridas en la plantilla.',
      data: { missingFields }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['use', 'DocumentBuilder']]),
    documentBuilderService
  })
  const res = await request(app)
    .post('/api/document-builder/generate?companyId=c1')
    .send({ supplierId: 's1', template: { kind: 'standard', id: 't1' }, dryRun: true })
  assert.equal(res.statusCode, 422)
  assert.equal(res.body?.error?.code, 'MISSING_PLACEHOLDERS')
  assert.deepEqual(res.body?.meta?.missingFields, missingFields)
  assert.equal(res.body?.error?.missingFieldKeys, undefined)
})

test('GET /api/document-builder/templates passes supplier_type to service', async () => {
  let receivedSupplierType
  const documentBuilderService = {
    listEligibleTemplates: async ({ supplierType } = {}) => {
      receivedSupplierType = supplierType
      return {
        ok: true,
        data: {
          items: [
            {
              kind: 'standard',
              id: 't1',
              name: 'Contrato PN',
              description: null,
              status: 'active',
              supplier_type: 'persona_natural',
            },
          ],
        },
      }
    },
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['use', 'DocumentBuilder']]),
    documentBuilderService,
  })
  const res = await request(app)
    .get('/api/document-builder/templates')
    .query({ companyId: 'c1', supplier_type: 'persona_natural' })
  assert.equal(res.statusCode, 200)
  assert.equal(receivedSupplierType, 'persona_natural')
  assert.equal(res.body?.data?.items?.[0]?.supplier_type, 'persona_natural')
})

test('GET /api/document-builder/templates returns 400 for invalid supplier_type', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['use', 'DocumentBuilder']]),
    documentBuilderService: {
      listEligibleTemplates: async () => ({ ok: true, data: { items: [] } }),
    },
  })
  const res = await request(app)
    .get('/api/document-builder/templates')
    .query({ companyId: 'c1', supplier_type: 'foo' })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})
