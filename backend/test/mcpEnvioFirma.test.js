const test = require('node:test')
const assert = require('node:assert/strict')

const DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function createMockServer() {
  const tools = new Map()
  return {
    tool(name, description, schema, handler) {
      tools.set(name, { description, schema, handler })
    },
    getTool(name) {
      return tools.get(name)
    }
  }
}

const suggestion = {
  first_names: 'DAVID',
  last_name: 'ROCO',
  maternal_last_name: 'PEREZ',
  document_number: '11.832.526-5',
  email: 'firmante@example.com'
}

async function setup({ firme, signing, builder } = {}) {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService: builder ?? {},
    contractsQueryService: {},
    contractSigningService: signing ?? {
      listPendingSignature: async () => ({
        ok: true,
        data: { items: [{ id: DRAFT_ID, signee_suggestion: suggestion }] }
      })
    },
    storageService: {},
    getUserProfileIdByUserId: async () => 'profile-1',
    firmeSigningService: firme
  })
  return server
}

async function call(server, name, args) {
  const raw = await server.getTool(name).handler(args)
  return JSON.parse(raw.content[0].text)
}

test('firmar_contrato_electronico usa signee_suggestion y el perfil MCP', async () => {
  let received = null
  const server = await setup({
    firme: {
      getSigningMode: async () => 'firme',
      sendToFirme: async (args) => {
        received = args
        return { ok: true, status: 202, data: { signingId: 's1', status: 'pending_signature' } }
      }
    }
  })
  const out = await call(server, 'firmar_contrato_electronico', { draftDocumentId: DRAFT_ID })
  assert.equal(out.ok, true)
  assert.equal(out.data.status, 'pending_signature')
  assert.equal(out.data.signingId, 's1')
  assert.equal(out.data.sentTo, 'firmante@example.com')
  assert.deepEqual(received, {
    draftDocumentId: DRAFT_ID,
    signee: {
      firstName: 'DAVID',
      lastName: 'ROCO',
      maternalLastName: 'PEREZ',
      documentNumber: '11.832.526-5',
      email: 'firmante@example.com'
    },
    approvedByUserProfileId: 'profile-1'
  })
})

test('firmar_contrato_electronico: lo que envía el usuario pisa la sugerencia', async () => {
  let received = null
  const server = await setup({
    firme: {
      getSigningMode: async () => 'firme',
      sendToFirme: async (args) => {
        received = args
        return { ok: true, status: 202, data: { signingId: 's1', status: 'pending_signature' } }
      }
    }
  })
  const out = await call(server, 'firmar_contrato_electronico', {
    draftDocumentId: DRAFT_ID,
    firmante: { email: ' otro@example.com ', first_names: '' }
  })
  assert.equal(out.ok, true)
  assert.equal(received.signee.email, 'otro@example.com')
  assert.equal(received.signee.firstName, 'DAVID')
  assert.equal(out.data.sentTo, 'otro@example.com')
})

test('firmar_contrato_electronico devuelve el error del servicio tal cual', async () => {
  const server = await setup({
    firme: {
      getSigningMode: async () => 'firme',
      sendToFirme: async () => ({ ok: false, status: 409, code: 'NO_APLICA_FIRME', message: 'Este contrato no se envía por Firme.' })
    }
  })
  const out = await call(server, 'firmar_contrato_electronico', { draftDocumentId: DRAFT_ID })
  assert.equal(out.ok, false)
  assert.equal(out.code, 'NO_APLICA_FIRME')
})

test('la descripción exige confirmación, avisa del correo y cubre firme e interna', async () => {
  const server = await setup({ firme: {} })
  const { description } = server.getTool('firmar_contrato_electronico')
  assert.ok(description.includes('confirmación explícita'))
  assert.ok(description.includes('CORREO'))
  assert.ok(description.includes('FIRME'))
  assert.ok(description.includes('INTERNA'))
})

test('en flujo interna firma internamente y no envía a Firme', async () => {
  let signed = 0
  let sent = 0
  const server = await setup({
    firme: {
      getSigningMode: async () => 'internal',
      sendToFirme: async () => {
        sent += 1
        return { ok: true }
      }
    },
    signing: {
      listPendingSignature: async () => ({ ok: true, data: { items: [] } }),
      signContract: async () => {
        signed += 1
        return { ok: true, data: { documentId: 'doc-1' } }
      }
    }
  })
  const out = await call(server, 'firmar_contrato_electronico', { draftDocumentId: DRAFT_ID })
  assert.equal(out.ok, true)
  assert.equal(signed, 1)
  assert.equal(sent, 0)
})

test('listar_documentos_pendientes_firma agrega signature_flow', async () => {
  const server = await setup({
    firme: { getSigningMode: async (id) => (id === DRAFT_ID ? 'firme' : 'internal') },
    signing: {
      listPendingSignature: async () => ({
        ok: true,
        data: { items: [{ id: DRAFT_ID }, { id: 'otro' }] }
      })
    }
  })
  const out = await call(server, 'listar_documentos_pendientes_firma', {})
  assert.deepEqual(out.data.items.map((i) => i.signature_flow), ['firme', 'interna'])
})

test('generar_contrato agrega signature_flow a cada documento', async () => {
  const server = await setup({
    firme: { getSigningMode: async () => 'firme' },
    builder: {
      generateAndPersist: async () => ({
        ok: true,
        data: { documents: [{ id: DRAFT_ID, file_name: 'x.pdf', status: 'draft' }] }
      })
    }
  })
  const out = await call(server, 'generar_contrato', {
    companyId: DRAFT_ID,
    supplierId: DRAFT_ID,
    templateId: DRAFT_ID
  })
  assert.equal(out.data.documents[0].signature_flow, 'firme')
  assert.equal(out.data.documents[0].id, DRAFT_ID)
})

test('estado_firma devuelve el estado del envío y el del firmante', async () => {
  const server = await setup({
    firme: {
      refreshForDraft: async () => ({ ok: true, data: { status: 'pending_signature' } }),
      listInSignature: async () => [
        {
          id: DRAFT_ID,
          status: 'pending_signature',
          supplier_name: 'DAVID ROCO PEREZ',
          signee_first_name: 'DAVID',
          signee_last_name: 'ROCO',
          signee_maternal_last_name: 'PEREZ',
          signee_rut: '11832526-5',
          signee_email: 'firmante@example.com',
          approved_at: '2026-11-12T12:00:00Z',
          rejection_reason: null,
          last_error_code: null,
          last_error_message: null
        }
      ]
    }
  })
  const out = await call(server, 'estado_firma', { draftDocumentId: DRAFT_ID })
  assert.equal(out.ok, true)
  assert.equal(out.data.status, 'pending_signature')
  assert.equal(out.data.signee_email, 'firmante@example.com')
})

test('estado_firma de un contrato ya firmado devuelve signed', async () => {
  const server = await setup({
    firme: {
      refreshForDraft: async () => ({ ok: true, data: { status: 'signed' } }),
      listInSignature: async () => []
    }
  })
  const out = await call(server, 'estado_firma', { draftDocumentId: DRAFT_ID })
  assert.equal(out.data.status, 'signed')
})

test('estado_firma sin envío previo devuelve el error del servicio', async () => {
  const server = await setup({
    firme: {
      refreshForDraft: async () => ({ ok: false, status: 404, code: 'NOT_FOUND', message: 'No hay un envío a firma para este contrato.' }),
      listInSignature: async () => []
    }
  })
  const out = await call(server, 'estado_firma', { draftDocumentId: DRAFT_ID })
  assert.equal(out.ok, false)
  assert.equal(out.code, 'NOT_FOUND')
})

test('estado_firma sin servicio de Firme responde FIRME_NO_DISPONIBLE', async () => {
  const server = await setup({ firme: undefined })
  const out = await call(server, 'estado_firma', { draftDocumentId: DRAFT_ID })
  assert.equal(out.code, 'FIRME_NO_DISPONIBLE')
})
