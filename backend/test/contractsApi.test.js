const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

const mockListResult = {
  ok: true,
  data: {
    items: [
      {
        id: 'd1',
        source: 'draft',
        supplier_name: 'Acme SpA',
        supplier_type: 'empresa',
        client_name: 'Cliente',
        template_name: 'Plantilla',
        file_name: 'contrato.pdf',
        gcs_path: 'path/to.pdf',
        status: 'draft',
        created_at: '2026-05-01T00:00:00.000Z',
        fecha_contrato: '2026-05-01',
        mes_ejecucion: 'Mayo 2026',
        proveedor_red_social: 'Instagram',
        proveedor_cuenta_social: '@acme',
        precio_numero: '1.000.000'
      }
    ],
    pagination: { page: 1, pageSize: 18, total: 1, totalPages: 1 }
  }
}

test('GET /api/contracts returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/contracts')
  assert.equal(res.statusCode, 403)
})

test('GET /api/contracts returns 200 with items', async () => {
  let receivedArgs
  const contractsQueryService = {
    listContracts: async (args) => {
      receivedArgs = args
      return mockListResult
    },
    getContractPdf: async () => ({ ok: false, status: 404 })
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Contract']]),
    contractsQueryService
  })

  const res = await request(app)
    .get('/api/contracts')
    .query({ page: 2, supplierSearch: 'acme', status: 'draft' })

  assert.equal(res.statusCode, 200)
  assert.equal(receivedArgs.page, '2')
  assert.equal(receivedArgs.filters.supplierSearch, 'acme')
  assert.equal(receivedArgs.filters.status, 'draft')
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.id, 'd1')
})

test('GET /api/contracts/:id/pdf returns PDF for draft', async () => {
  const contractsQueryService = {
    listContracts: async () => mockListResult,
    getContractPdf: async ({ id, source }) => {
      assert.equal(id, 'd1')
      assert.equal(source, 'draft')
      return {
        ok: true,
        data: {
          file_name: 'contrato.pdf',
          buffer: Buffer.from('%PDF-test')
        }
      }
    }
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Contract']]),
    contractsQueryService
  })

  const res = await request(app).get('/api/contracts/d1/pdf').query({ source: 'draft' })
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /application\/pdf/)
  assert.match(String(res.headers['content-disposition']), /inline/)
})

test('GET /api/contracts/:id/pdf returns 404 when missing', async () => {
  const contractsQueryService = {
    listContracts: async () => mockListResult,
    getContractPdf: async () => ({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Contrato no encontrado.'
    })
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Contract']]),
    contractsQueryService
  })

  const res = await request(app).get('/api/contracts/missing/pdf').query({ source: 'signed' })
  assert.equal(res.statusCode, 404)
})

test('GET /api/contracts/:id/pdf returns 400 for invalid source', async () => {
  const contractsQueryService = {
    listContracts: async () => mockListResult,
    getContractPdf: async () => ({
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Parámetro source inválido. Use draft o signed.'
    })
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Contract']]),
    contractsQueryService
  })

  const res = await request(app).get('/api/contracts/d1/pdf').query({ source: 'bad' })
  assert.equal(res.statusCode, 400)
})
