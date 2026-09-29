const test = require('node:test')
const assert = require('node:assert/strict')

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

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '22222222-2222-2222-2222-222222222222'
const TEMPLATE_ID = '33333333-3333-3333-3333-333333333333'

test('The tool exists and forbids applying a suggestion', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const server = createMockServer()
  registerMcpTools(server, {
    db: {},
    supplierService: {},
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: {},
    contractSigningService: {},
    gcsService: {},
    getUserProfileIdByUserId: async () => null
  })

  const reviewTool = server.getTool('revisar_redaccion')
  assert.ok(reviewTool)
  assert.ok(
    reviewTool.description.includes('PROHIBIDO aplicar una sugerencia sin que la persona la acepte')
  )
  assert.equal(reviewTool.schema.reviewId, undefined)
  assert.equal(reviewTool.schema.generarIgual, undefined)

  const validateTool = server.getTool('validar_contrato')
  assert.equal(validateTool.schema.reviewId, undefined)
  assert.equal(validateTool.schema.generarIgual, undefined)
})

test('The handler reviews and does not generate', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const calls = { review: [], generate: [] }
  const documentBuilderService = {
    reviewDraft: async (args) => {
      calls.review.push(args)
      return { ok: true, data: { reviewId: 'r1', verdict: 'ok', observations: [] } }
    },
    generateAndPersist: async (args) => {
      calls.generate.push(args)
      return { ok: true, data: {} }
    }
  }
  const server = createMockServer()
  registerMcpTools(server, {
    db: {},
    supplierService: {},
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService,
    contractsQueryService: {},
    contractSigningService: {},
    gcsService: {},
    getUserProfileIdByUserId: async () => null
  })

  const reviewTool = server.getTool('revisar_redaccion')
  await reviewTool.handler({
    companyId: COMPANY_ID,
    supplierId: SUPPLIER_ID,
    templateId: TEMPLATE_ID
  })

  assert.equal(calls.review.length, 1)
  assert.equal(calls.generate.length, 0)
  assert.equal(calls.review[0].requestedCompanyId, COMPANY_ID)
  assert.equal(calls.review[0].body.supplierId, SUPPLIER_ID)
  assert.deepEqual(calls.review[0].body.template, { kind: 'standard', id: TEMPLATE_ID })
  assert.equal(calls.review[0].body.dryRun, undefined)
})

test('Generate accepts a review and forbids writing the motivo', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const calls = []
  const documentBuilderService = {
    reviewDraft: async () => ({ ok: true, data: {} }),
    generateAndPersist: async (args) => {
      calls.push(args)
      return { ok: true, data: { documents: [] } }
    }
  }
  const server = createMockServer()
  registerMcpTools(server, {
    db: {},
    supplierService: {},
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService,
    contractsQueryService: {},
    contractSigningService: {},
    gcsService: {},
    getUserProfileIdByUserId: async () => null
  })

  const generateTool = server.getTool('generar_contrato')
  assert.ok(generateTool.schema.reviewId)
  assert.ok(generateTool.schema.generarIgual)
  assert.ok(generateTool.description.includes('PROHIBIDO decidirlo o redactarlo por cuenta propia'))
  assert.equal(generateTool.description.includes('dynamic_text'), false)
  assert.ok(generateTool.description.includes('textos dinámicos'))
  assert.ok(generateTool.description.includes('confirmación explícita'))

  await generateTool.handler({
    companyId: COMPANY_ID,
    supplierId: SUPPLIER_ID,
    templateId: TEMPLATE_ID,
    reviewId: 'rev-1',
    generarIgual: { motivo: 'la persona lo dictó así' }
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].body.reviewId, 'rev-1')
  assert.deepEqual(calls[0].body.generarIgual, { motivo: 'la persona lo dictó así' })
  assert.equal(calls[0].body.dryRun, undefined)
})
