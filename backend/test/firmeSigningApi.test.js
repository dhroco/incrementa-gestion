const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

function appWith(firmeSigningService, extra = {}) {
  return createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules(extra.rules || [['sign', 'Contract']]),
    contractSigningService: extra.contractSigningService || {
      listPendingSignature: async () => ({ ok: true, data: { items: [] } }),
      signContract: async () => ({ ok: true, data: { documentId: 'doc-1' } })
    },
    contractsQueryService: extra.contractsQueryService,
    userProfileIdResolver: extra.userProfileIdResolver || (async () => 'profile-1'),
    firmeSigningService
  })
}

const signee = {
  firstName: 'Ana',
  lastName: 'Pérez',
  maternalLastName: 'Soto',
  rut: '12.345.678-5',
  email: 'ana@ejemplo.cl'
}

test('send-to-firme returns 202 and preserves service errors', async () => {
  let received = null
  const firmeSigningService = {
    async sendToFirme(args) {
      received = args
      return { ok: true, status: 202, data: { signingId: 's1', status: 'pending_signature' } }
    }
  }
  const app = appWith(firmeSigningService)
  const ok = await request(app).post('/api/contracts/d1/send-to-firme').send({ signee })
  assert.equal(ok.statusCode, 202)
  assert.equal(ok.body.data.signingId, 's1')
  assert.equal(received.draftDocumentId, 'd1')
  assert.equal(received.approvedByUserProfileId, 'profile-1')
  assert.deepEqual(received.signee, signee)

  firmeSigningService.sendToFirme = async () => ({
    ok: false,
    status: 422,
    code: 'RUT_INVALIDO',
    message: 'El RUT del firmante no es válido.'
  })
  const bad = await request(app).post('/api/contracts/d1/send-to-firme').send({ signee })
  assert.equal(bad.statusCode, 422)
  assert.equal(bad.body.error.code, 'RUT_INVALIDO')
})

test('Firme routes require sign on Contract', async () => {
  const app = appWith(
    { async sendToFirme() { return { ok: true, status: 202, data: {} } } },
    { rules: [['read', 'Contract']] }
  )
  const res = await request(app).post('/api/contracts/d1/send-to-firme').send({ signee })
  assert.equal(res.statusCode, 403)
})

test('in-signature returns attempts and credits and is not the pdf route', async () => {
  let pdfCalled = false
  const app = appWith(
    {
      async getInSignature() {
        return { ok: true, data: { items: [{ id: 'd1', status: 'pending_signature' }] }, meta: { credits: 7 } }
      }
    },
    {
      rules: [['sign', 'Contract'], ['read', 'Contract']],
      contractsQueryService: {
        listContracts: async () => ({ ok: true, data: { items: [], pagination: {} } }),
        getContractPdf: async () => {
          pdfCalled = true
          return { ok: true, data: {} }
        }
      }
    }
  )
  const res = await request(app).get('/api/contracts/in-signature')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.data.items[0].id, 'd1')
  assert.equal(res.body.meta.credits, 7)
  assert.equal(pdfCalled, false)
})

test('missing Firme service makes new routes unavailable and the webhook stays 200', async () => {
  const app = appWith(null)
  for (const call of [
    () => request(app).post('/api/contracts/d1/send-to-firme').send({ signee }),
    () => request(app).get('/api/contracts/in-signature'),
    () => request(app).post('/api/contracts/d1/refresh-signature'),
    () => request(app).post('/api/contracts/d1/resend-link')
  ]) {
    const res = await call()
    assert.equal(res.statusCode, 503)
    assert.equal(res.body.error.code, 'FIRME_NO_DISPONIBLE')
  }
  const hook = await request(app).post('/api/webhooks/firme').set('Content-Type', 'text/plain').send('aviso')
  assert.equal(hook.statusCode, 200)
  assert.deepEqual(hook.body, { ok: true })
})

test('the webhook returns 200 when the service throws', async () => {
  let raw = null
  const app = appWith({
    async handleWebhook({ rawBody }) {
      raw = rawBody
      throw new Error('boom')
    }
  })
  const res = await request(app).post('/api/webhooks/firme').set('Content-Type', 'text/plain').send('hola')
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.equal(raw, 'hola')
})

test('sign is blocked for firme and blocked modes and stays available without the service', async () => {
  let signed = 0
  const contractSigningService = {
    listPendingSignature: async () => ({ ok: true, data: { items: [] } }),
    signContract: async () => {
      signed += 1
      return { ok: true, data: { documentId: 'doc-1' } }
    }
  }

  const firme = appWith(
    { getSigningMode: async () => 'firme' },
    { contractSigningService }
  )
  const firmeRes = await request(firme).post('/api/contracts/d1/sign')
  assert.equal(firmeRes.statusCode, 409)
  assert.equal(firmeRes.body.error.code, 'USE_FIRME_FLOW')
  assert.equal(signed, 0)

  const blocked = appWith(
    { getSigningMode: async () => 'blocked' },
    { contractSigningService }
  )
  const blockedRes = await request(blocked).post('/api/contracts/d1/sign')
  assert.equal(blockedRes.statusCode, 409)
  assert.equal(blockedRes.body.error.code, 'FIRMA_BLOQUEADA')
  assert.equal(signed, 0)

  const internal = appWith(
    { getSigningMode: async () => 'internal' },
    { contractSigningService }
  )
  const internalRes = await request(internal).post('/api/contracts/d1/sign')
  assert.equal(internalRes.statusCode, 200)
  assert.equal(signed, 1)

  const absent = appWith(null, { contractSigningService })
  const absentRes = await request(absent).post('/api/contracts/d1/sign')
  assert.equal(absentRes.statusCode, 200)
  assert.equal(signed, 2)
})

function createMockServer() {
  const tools = new Map()
  return {
    tool(name, _description, _schema, handler) {
      tools.set(name, { handler })
    },
    getTool(name) {
      return tools.get(name)
    }
  }
}

test('MCP sign follows firme, blocked, and absent modes', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const draftId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  let signed = 0
  const contractSigningService = {
    listPendingSignature: async () => ({ ok: true, data: { items: [] } }),
    signContract: async () => {
      signed += 1
      return { ok: true, data: { documentId: 'doc-1' } }
    }
  }
  const baseDeps = {
    db: () => ({ select() { return this }, orderBy() { return this }, then(resolve) { return Promise.resolve(resolve([])) } }),
    supplierService: {},
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: { listContracts: async () => ({ ok: true, data: { items: [] } }) },
    contractSigningService,
    storageService: {},
    getUserProfileIdByUserId: async () => 'profile-1'
  }

  async function run(firmeSigningService) {
    const server = createMockServer()
    registerMcpTools(server, { ...baseDeps, firmeSigningService })
    const raw = await server.getTool('firmar_contrato_electronico').handler({ draftDocumentId: draftId })
    return JSON.parse(raw.content[0].text)
  }

  const firme = await run({ getSigningMode: async () => 'firme' })
  assert.equal(firme.code, 'USE_FIRME_FLOW')
  assert.equal(signed, 0)

  const blocked = await run({ getSigningMode: async () => 'blocked' })
  assert.equal(blocked.code, 'FIRMA_BLOQUEADA')
  assert.equal(signed, 0)

  const absent = await run(undefined)
  assert.equal(absent.ok, true)
  assert.equal(signed, 1)
})
