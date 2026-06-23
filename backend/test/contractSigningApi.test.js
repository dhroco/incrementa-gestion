const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

const mockPending = {
  ok: true,
  data: {
    items: [
      {
        id: 'd1',
        supplier_name: 'Acme SpA',
        supplier_type: 'empresa',
        client_name: null,
        template_name: 'Plantilla',
        company_name: 'Empresa SpA',
        company_short_name: 'Empresa',
        company_email: 'empresa@test.cl',
        fecha_contrato: '2026-06-01',
        created_at: '2026-06-01T00:00:00.000Z',
        file_name: 'contrato.pdf',
        gcs_path: 'path/to.pdf'
      }
    ]
  }
}

test('GET /api/contracts/pending-signature returns 403 without sign grant', async () => {
  const contractSigningService = {
    listPendingSignature: async () => mockPending,
    signContract: async () => ({ ok: true, data: {} })
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Contract']]),
    contractSigningService
  })

  const res = await request(app).get('/api/contracts/pending-signature')
  assert.equal(res.statusCode, 403)
})

test('GET /api/contracts/pending-signature returns 200 with items', async () => {
  const contractSigningService = {
    listPendingSignature: async () => mockPending,
    signContract: async () => ({ ok: true, data: {} })
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['sign', 'Contract']]),
    contractSigningService
  })

  const res = await request(app).get('/api/contracts/pending-signature')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.id, 'd1')
})

test('POST /api/contracts/:id/sign returns 200 on success', async () => {
  let signArgs = null
  const contractSigningService = {
    listPendingSignature: async () => mockPending,
    signContract: async (args) => {
      signArgs = args
      return {
        ok: true,
        data: { documentId: 'doc-1', fileName: 'firmado.pdf', companyEmail: 'empresa@test.cl' }
      }
    }
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['sign', 'Contract']]),
    contractSigningService,
    userProfileIdResolver: async () => 'profile-1'
  })

  const res = await request(app).post('/api/contracts/d1/sign')
  assert.equal(res.statusCode, 200)
  assert.equal(signArgs.draftDocumentId, 'd1')
  assert.equal(signArgs.signerUserProfileId, 'profile-1')
  assert.equal(res.body?.data?.documentId, 'doc-1')
})

test('GET /api/contracts/pending-signature is not captured by pdf route', async () => {
  const contractSigningService = {
    listPendingSignature: async () => mockPending,
    signContract: async () => ({ ok: true, data: {} })
  }

  const contractsQueryService = {
    listContracts: async () => ({ ok: true, data: { items: [], pagination: {} } }),
    getContractPdf: async () => {
      throw new Error('pdf handler should not run for pending-signature')
    }
  }

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['sign', 'Contract'], ['read', 'Contract']]),
    contractSigningService,
    contractsQueryService
  })

  const res = await request(app).get('/api/contracts/pending-signature')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
})
