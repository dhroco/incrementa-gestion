const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('GET /api/suppliers returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/suppliers')
  assert.equal(res.statusCode, 403)
})

test('GET /api/suppliers returns 200 with items and search', async () => {
  let receivedSearch
  const supplierService = {
    listSuppliers: async ({ search } = {}) => {
      receivedSearch = search
      return {
        ok: true,
        data: {
          items: [
            {
              id: 's1',
              supplier_type: 'empresa',
              display_name: 'Acme SpA',
              rut: '76.543.210-3',
              social_network_count: 2
            }
          ]
        }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/suppliers').query({ search: 'acme' })
  assert.equal(res.statusCode, 200)
  assert.equal(receivedSearch, 'acme')
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.id, 's1')
})

test('POST /api/suppliers creates persona natural', async () => {
  const supplierService = {
    createSupplier: async ({ payload, userId }) => {
      assert.equal(userId, 'profile-1')
      assert.equal(payload.supplier_type, 'persona_natural')
      assert.equal(payload.full_name, 'Juan Pérez')
      return {
        ok: true,
        data: { supplier: { id: 'new-1', supplier_type: 'persona_natural', full_name: 'Juan Pérez' } }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Supplier']]),
    userProfileIdResolver: async () => 'profile-1',
    supplierService
  })

  const res = await request(app)
    .post('/api/suppliers')
    .send({
      supplier_type: 'persona_natural',
      full_name: 'Juan Pérez',
      rut: '12.345.678-5',
      social_networks: [{ catalog_id: '11111111-1111-4111-8111-111111111111', account_name: '@juan' }]
    })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.supplier?.id, 'new-1')
})

test('PUT /api/suppliers/:id updates social networks', async () => {
  const supplierService = {
    updateSupplier: async (id, { payload }) => {
      assert.equal(id, 's1')
      assert.equal(payload.social_networks.length, 1)
      return { ok: true, data: { supplier: { id: 's1', social_network_count: 1 } } }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Supplier']]),
    userProfileIdResolver: async () => 'profile-1',
    supplierService
  })

  const res = await request(app)
    .put('/api/suppliers/s1')
    .send({ social_networks: [{ catalog_id: '22222222-2222-4222-8222-222222222222', account_name: '@acme' }] })

  assert.equal(res.statusCode, 200)
})

test('GET /api/suppliers/:id returns 404 when not found', async () => {
  const supplierService = {
    getSupplierById: async () => ({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Proveedor no encontrado.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/suppliers/missing')
  assert.equal(res.statusCode, 404)
  assert.equal(res.body?.error?.code, 'NOT_FOUND')
  assert.match(String(res.body?.error?.message || ''), /no encontrado/i)
})

test('GET /api/suppliers/:id/documents returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/suppliers/s1/documents')
  assert.equal(res.statusCode, 403)
})

test('GET /api/suppliers/:id/documents returns 200 with lists', async () => {
  const supplierService = {
    listSupplierDocuments: async (id) => {
      assert.equal(id, 's1')
      return {
        ok: true,
        data: {
          signed_documents: [{ id: 'd1', template_name: 'Contrato', file_name: 'a.pdf' }],
          draft_documents: [{ id: 'dd1', template_name: 'Contrato', file_name: 'b.pdf', status: 'draft' }]
        }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/suppliers/s1/documents')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.signed_documents?.length, 1)
  assert.equal(res.body?.data?.draft_documents?.length, 1)
})

test('GET /api/suppliers/:id/documents returns 404 when supplier missing', async () => {
  const supplierService = {
    listSupplierDocuments: async () => ({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Proveedor no encontrado.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/suppliers/missing/documents')
  assert.equal(res.statusCode, 404)
})

test('GET /api/suppliers/:id/documents/:documentId/view returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/suppliers/s1/documents/d1/view')
  assert.equal(res.statusCode, 403)
})

test('GET /api/suppliers/:id/documents/:documentId/view serves inline PDF', async () => {
  const supplierService = {
    getSupplierDocumentForView: async (supplierId, documentId) => {
      assert.equal(supplierId, 's1')
      assert.equal(documentId, 'd1')
      return {
        ok: true,
        data: { file_name: 'contrato.pdf', buffer: Buffer.from('%PDF-1.4 test') }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/suppliers/s1/documents/d1/view')
  assert.equal(res.statusCode, 200)
  assert.match(String(res.headers['content-disposition'] || ''), /^inline;/)
  assert.equal(res.headers['content-type'], 'application/pdf')
})

test('GET /api/suppliers/:id/documents/:documentId/view returns 404 when not found', async () => {
  const supplierService = {
    getSupplierDocumentForView: async () => ({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Documento no encontrado.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/suppliers/s1/documents/missing/view')
  assert.equal(res.statusCode, 404)
})

test('GET /api/social-networks/catalog returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/social-networks/catalog')
  assert.equal(res.statusCode, 403)
})

test('GET /api/social-networks/catalog returns ordered items', async () => {
  const supplierService = {
    listSocialNetworkCatalog: async () => ({
      ok: true,
      data: {
        items: [
          { id: 'a1', code: 'instagram', name: 'Instagram', sort_order: 1 },
          { id: 'a2', code: 'facebook', name: 'Facebook', sort_order: 2 }
        ]
      }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Supplier']]),
    supplierService
  })

  const res = await request(app).get('/api/social-networks/catalog')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 2)
  assert.equal(res.body?.data?.items?.[0]?.code, 'instagram')
  assert.equal(res.body?.data?.items?.[1]?.sort_order, 2)
})

test('validateSocialNetworks rejects unknown catalog_id', async () => {
  const knexMod = require.resolve('../db/knex')
  const originalKnex = require.cache[knexMod]
  require.cache[knexMod] = {
    id: knexMod,
    filename: knexMod,
    loaded: true,
    exports: {
      db: () => ({
        select() {
          return this
        },
        async then(resolve) {
          return resolve([{ id: '11111111-1111-4111-8111-111111111111' }])
        }
      })
    }
  }

  try {
    delete require.cache[require.resolve('../services/supplierService')]
    const { _validateSocialNetworks } = require('../services/supplierService')
    const result = await _validateSocialNetworks([
      { catalog_id: '99999999-9999-4999-8999-999999999999', account_name: '@juan' }
    ])
    assert.equal(result.ok, false)
    assert.match(String(result.message || ''), /no es válida/i)
  } finally {
    if (originalKnex) require.cache[knexMod] = originalKnex
    else delete require.cache[knexMod]
    delete require.cache[require.resolve('../services/supplierService')]
  }
})
