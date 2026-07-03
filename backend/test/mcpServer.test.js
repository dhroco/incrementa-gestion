const test = require('node:test')
const assert = require('node:assert/strict')

const MCP_USER_ID = '00000000-0000-0000-0000-000000000001'
const PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SUPPLIER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const COMPANY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const TEMPLATE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const DRAFT_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const CLIENT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

const stubClientService = {
  listClients: async () => ({ ok: true, data: { items: [] } })
}

const stubContractsQueryService = {
  listContracts: async () => ({
    ok: true,
    data: { items: [], pagination: { page: 1, pageSize: 18, total: 0, totalPages: 0 } }
  })
}

const stubContractSigningService = {
  listPendingSignature: async () => ({
    ok: true,
    data: {
      items: [
        {
          id: DRAFT_ID,
          supplier_name: 'Acme SpA',
          template_name: 'Plantilla',
          company_short_name: 'Empresa'
        }
      ]
    }
  }),
  signContract: async ({ draftDocumentId, signerUserProfileId }) => ({
    ok: true,
    data: {
      documentId: 'doc-signed-1',
      fileName: 'firmado.pdf',
      companyEmail: 'empresa@test.cl',
      draftDocumentId,
      signerUserProfileId
    }
  })
}

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

function parseToolJson(result) {
  assert.equal(result.content.length, 1)
  assert.equal(result.content[0].type, 'text')
  return JSON.parse(result.content[0].text)
}

test('MCP tools use MCP_USER_ID and return JSON responses', async () => {
  const {
    registerMcpTools,
    MCP_USER_ID: exportedUserId
  } = await import('../mcpTools.mjs')

  assert.equal(exportedUserId, MCP_USER_ID)

  let listSuppliersArgs = null
  let generateArgs = null
  let createSupplierArgs = null

  let listClientsArgs = null

  const clientService = {
    listClients: async (args) => {
      listClientsArgs = args
      return {
        ok: true,
        data: { items: [{ id: CLIENT_ID, name: 'Cliente', brand: 'Marca', product_campaigns: [] }] }
      }
    }
  }

  const supplierService = {
    listSuppliers: async (args) => {
      listSuppliersArgs = args
      return { ok: true, data: { items: [{ id: SUPPLIER_ID }] } }
    },
    getSupplierById: async (id) => ({
      ok: true,
      data: { supplier: { id, supplier_type: 'persona_natural' } }
    }),
    createSupplier: async (args) => {
      createSupplierArgs = args
      return { ok: true, data: { supplier: { id: SUPPLIER_ID } } }
    },
    updateSupplier: async (id, args) => ({
      ok: true,
      data: { supplier: { id, updated: true, actor: args.userId } }
    })
  }

  const standardTemplatesService = {
    listStandardTemplates: async () => ({
      ok: true,
      items: [{ id: TEMPLATE_ID, name: 'Plantilla test' }]
    })
  }

  const documentBuilderService = {
    generateAndPersist: async (args) => {
      generateArgs = args
      return { ok: true, data: { valid: true } }
    }
  }

  const dbCalls = []
  const db = (table) => {
    dbCalls.push(table)
    return {
      select() {
        return this
      },
      orderBy() {
        return this
      },
      then(resolve) {
        return Promise.resolve(
          resolve([
            {
              id: COMPANY_ID,
              business_name: 'Dynamics Corp Spa',
              short_name: 'Dynamics',
              rut_body: '761234567',
              rut_dv: '8'
            }
          ])
        )
      }
    }
  }

  const getUserProfileIdByUserId = async (userId) => {
    assert.equal(userId, MCP_USER_ID)
    return PROFILE_ID
  }

  const gcsService = {
    getSignedUrl: async () => 'https://storage.googleapis.com/signed-url'
  }

  const server = createMockServer()
  registerMcpTools(server, {
    db,
    supplierService,
    clientService,
    standardTemplatesService,
    documentBuilderService,
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService,
    getUserProfileIdByUserId
  })

  const listClientsTool = server.getTool('listar_clientes')
  const listClientsResult = parseToolJson(await listClientsTool.handler({ search: 'marca' }))
  assert.equal(listClientsResult.ok, true)
  assert.deepEqual(listClientsArgs, { search: 'marca' })

  const listTool = server.getTool('listar_proveedores')
  assert.ok(listTool.description.includes('ANTES'))
  const listResult = parseToolJson(await listTool.handler({ search: 'acme' }))
  assert.equal(listResult.ok, true)
  assert.deepEqual(listSuppliersArgs, { search: 'acme' })

  const createTool = server.getTool('crear_proveedor')
  const createResult = parseToolJson(
    await createTool.handler({
      payload: { supplier_type: 'persona_natural', full_name: 'Ana', rut: '11.111.111-1' }
    })
  )
  assert.equal(createResult.ok, true)
  assert.equal(createSupplierArgs.userId, PROFILE_ID)

  const validateTool = server.getTool('validar_contrato')
  assert.ok(validateTool.description.includes('NO genera PDF'))
  assert.ok(validateTool.description.includes('values'))
  assert.ok(validateTool.description.includes('pairField'))
  parseToolJson(
    await validateTool.handler({
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      templateId: TEMPLATE_ID,
      clientId: CLIENT_ID
    })
  )
  assert.equal(generateArgs.userId, MCP_USER_ID)
  assert.equal(generateArgs.requestedCompanyId, COMPANY_ID)
  assert.equal(generateArgs.body.dryRun, true)
  assert.equal(generateArgs.body.clientId, CLIENT_ID)

  const generateTool = server.getTool('generar_contrato')
  parseToolJson(
    await generateTool.handler({
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      templateId: TEMPLATE_ID,
      overwrite: true,
      clientId: CLIENT_ID
    })
  )
  assert.equal(generateArgs.body.overwrite, true)
  assert.equal(generateArgs.body.clientId, CLIENT_ID)
  assert.equal(generateArgs.body.dryRun, undefined)

  const companiesTool = server.getTool('listar_empresas')
  const companiesResult = parseToolJson(await companiesTool.handler({}))
  assert.equal(companiesResult.ok, true)
  assert.equal(companiesResult.data.items[0].business_name, 'Dynamics Corp Spa')
  assert.equal(companiesResult.data.items[0].short_name, 'Dynamics')
  assert.equal(dbCalls[0], 'company')
})

test('listar_plantillas passes supplier_type and status active to standardTemplatesService', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  let listTemplatesArgs = null
  const standardTemplatesService = {
    listStandardTemplates: async (args) => {
      listTemplatesArgs = args
      return {
        ok: true,
        items: [{ id: TEMPLATE_ID, name: 'Plantilla empresa', supplier_type: 'empresa', status: 'active' }]
      }
    }
  }

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService,
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const tool = server.getTool('listar_plantillas')
  assert.ok(tool.description.includes('supplier_type'))
  assert.ok(tool.description.includes('activas'))

  const result = parseToolJson(await tool.handler({ supplier_type: 'empresa' }))
  assert.equal(result.ok, true)
  assert.deepEqual(listTemplatesArgs, { search: undefined, supplier_type: 'empresa', status: 'active' })
  assert.equal(result.data.items[0].supplier_type, 'empresa')
  assert.equal(result.data.items[0].status, 'active')
})

test('obtener_plantilla returns template metadata and plain text content', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const contentJson = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Contrato para ' },
          { type: 'variable', attrs: { variableId: 'proveedor_nombre' } }
        ]
      }
    ]
  }

  let getByIdArgs = null
  let plainTextArgs = null
  const standardTemplatesService = {
    getStandardTemplateById: async (id) => {
      getByIdArgs = id
      return {
        ok: true,
        template: {
          id: TEMPLATE_ID,
          name: 'Plantilla PN',
          code: 'PN-001',
          supplier_type: 'persona_natural',
          status: 'active',
          description: 'Plantilla de prueba',
          content_json: contentJson
        }
      }
    }
  }

  const tipTapDocToPlainTextAsync = async (doc) => {
    plainTextArgs = doc
    return 'Contrato para {{proveedor_nombre}}'
  }

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService,
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID,
    tipTapDocToPlainTextAsync
  })

  const tool = server.getTool('obtener_plantilla')
  assert.ok(tool)
  assert.ok(tool.description.includes('listar_plantillas'))
  assert.ok(tool.description.includes('{{'))

  const result = parseToolJson(await tool.handler({ id: TEMPLATE_ID }))
  assert.equal(getByIdArgs, TEMPLATE_ID)
  assert.deepEqual(plainTextArgs, contentJson)
  assert.equal(result.ok, true)
  assert.equal(result.data.id, TEMPLATE_ID)
  assert.equal(result.data.name, 'Plantilla PN')
  assert.equal(result.data.code, 'PN-001')
  assert.equal(result.data.supplier_type, 'persona_natural')
  assert.equal(result.data.status, 'active')
  assert.equal(result.data.description, 'Plantilla de prueba')
  assert.equal(result.data.content, 'Contrato para {{proveedor_nombre}}')
})

test('obtener_plantilla returns NOT_FOUND for unknown template id', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const standardTemplatesService = {
    getStandardTemplateById: async () => ({ ok: false, notFound: true })
  }

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService,
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID,
    tipTapDocToPlainTextAsync: async () => ''
  })

  const tool = server.getTool('obtener_plantilla')
  const result = parseToolJson(await tool.handler({ id: TEMPLATE_ID }))
  assert.equal(result.ok, false)
  assert.equal(result.code, 'NOT_FOUND')
  assert.equal(result.message, 'Plantilla no encontrada.')
})

test('MCP_USER_ID matches migration 019 technical user', async () => {
  const { MCP_USER_ID: exportedUserId } = await import('../mcpTools.mjs')
  assert.equal(exportedUserId, '00000000-0000-0000-0000-000000000001')
})

function createDraftDocumentDb(row) {
  return (table) => {
    if (table === 'draft_document') {
      return {
        select() {
          return this
        },
        where() {
          return this
        },
        first() {
          return Promise.resolve(row)
        }
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  }
}

test('obtener_url_contrato returns signed URL for existing draft', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  let signedUrlArgs = null
  const gcsService = {
    getSignedUrl: async (args) => {
      signedUrlArgs = args
      return 'https://storage.googleapis.com/signed-url'
    }
  }

  const db = createDraftDocumentDb({
    id: DRAFT_ID,
    file_name: 'Contrato_test.pdf',
    gcs_path: 'contratos/co/su/tpl/2026/05/doc.pdf'
  })

  const server = createMockServer()
  registerMcpTools(server, {
    db,
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService,
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const tool = server.getTool('obtener_url_contrato')
  assert.ok(tool.description.includes('generar_contrato'))
  assert.ok(tool.description.includes('60 minutos'))

  const result = parseToolJson(await tool.handler({ documentId: DRAFT_ID }))
  assert.equal(result.ok, true)
  assert.equal(result.data.documentId, DRAFT_ID)
  assert.equal(result.data.file_name, 'Contrato_test.pdf')
  assert.equal(result.data.signedUrl, 'https://storage.googleapis.com/signed-url')
  assert.equal(result.data.expiresInMinutes, 60)
  assert.ok(result.data.expiresAt)
  assert.deepEqual(signedUrlArgs, {
    gcsPath: 'contratos/co/su/tpl/2026/05/doc.pdf',
    expiresInMinutes: 60
  })
})

test('obtener_url_contrato returns NOT_FOUND for unknown draft', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const db = createDraftDocumentDb(null)
  const server = createMockServer()
  registerMcpTools(server, {
    db,
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: { getSignedUrl: async () => 'https://example.com' },
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const tool = server.getTool('obtener_url_contrato')
  const result = parseToolJson(await tool.handler({ documentId: DRAFT_ID }))
  assert.equal(result.ok, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('listar_catalogo_redes returns catalog items from supplierService', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const supplierService = {
    listSocialNetworkCatalog: async () => ({
      ok: true,
      data: {
        items: [
          { id: '11111111-1111-1111-1111-111111111111', code: 'instagram', name: 'Instagram', sort_order: 1 },
          { id: '22222222-2222-2222-2222-222222222222', code: 'facebook', name: 'Facebook', sort_order: 2 }
        ]
      }
    })
  }

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService,
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const tool = server.getTool('listar_catalogo_redes')
  assert.ok(tool.description.includes('listar_catalogo_redes') || tool.description.includes('catalog_id'))
  assert.ok(tool.description.includes('ANTES'))

  const result = parseToolJson(await tool.handler({}))
  assert.equal(result.ok, true)
  assert.equal(result.data.items.length, 2)
  assert.equal(result.data.items[0].code, 'instagram')
  assert.equal(result.data.items[0].name, 'Instagram')
  assert.equal(result.data.items[0].id, '11111111-1111-1111-1111-111111111111')
  assert.equal(result.data.items[0].sort_order, undefined)
})

test('crear_proveedor description documents catalog_id for social networks', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const createTool = server.getTool('crear_proveedor')
  const updateTool = server.getTool('actualizar_proveedor')
  assert.ok(createTool.description.includes('listar_catalogo_redes'))
  assert.ok(updateTool.description.includes('listar_catalogo_redes'))
  assert.ok(createTool.description.includes('catalog_id') || createTool.description.includes('social_networks'))
  assert.ok(updateTool.description.includes('catalog_id') || updateTool.description.includes('social_networks'))
})

test('obtener_url_contrato returns GCS_PATH_MISSING when draft has no gcs_path', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const db = createDraftDocumentDb({
    id: DRAFT_ID,
    file_name: 'Contrato_test.pdf',
    gcs_path: ''
  })
  const server = createMockServer()
  registerMcpTools(server, {
    db,
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: { getSignedUrl: async () => 'https://example.com' },
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const tool = server.getTool('obtener_url_contrato')
  const result = parseToolJson(await tool.handler({ documentId: DRAFT_ID }))
  assert.equal(result.ok, false)
  assert.equal(result.code, 'GCS_PATH_MISSING')
})

test('listar_documentos_pendientes_firma returns pending drafts', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService: stubContractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID
  })

  const tool = server.getTool('listar_documentos_pendientes_firma')
  assert.ok(tool.description.includes('pendientes de firma'))
  const result = parseToolJson(await tool.handler({}))
  assert.equal(result.ok, true)
  assert.equal(result.data.items.length, 1)
  assert.equal(result.data.items[0].id, DRAFT_ID)
})

test('firmar_contrato_electronico uses MCP profile as signer', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')

  let signArgs = null
  const contractSigningService = {
    ...stubContractSigningService,
    signContract: async (args) => {
      signArgs = args
      return stubContractSigningService.signContract(args)
    }
  }

  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({ select() { return this }, orderBy() { return this }, then(r) { return Promise.resolve(r([])) } }),
    supplierService: {},
    clientService: stubClientService,
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: stubContractsQueryService,
    contractSigningService,
    gcsService: {},
    getUserProfileIdByUserId: async (userId) => {
      assert.equal(userId, MCP_USER_ID)
      return PROFILE_ID
    }
  })

  const tool = server.getTool('firmar_contrato_electronico')
  assert.ok(tool.description.includes('confirmación explícita'))
  const result = parseToolJson(await tool.handler({ draftDocumentId: DRAFT_ID }))
  assert.equal(result.ok, true)
  assert.equal(signArgs.draftDocumentId, DRAFT_ID)
  assert.equal(signArgs.signerUserProfileId, PROFILE_ID)
})
