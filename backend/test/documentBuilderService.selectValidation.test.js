const test = require('node:test')
const assert = require('node:assert/strict')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'
const CLIENT_ID = '99999999-9999-9999-9999-999999999999'

const SUPPLIER = {
  supplier_type: 'persona_natural',
  country_code: 'CL',
  full_name: 'Juan Pérez',
  document_display: '11.111.111-1',
  address: 'Calle 1'
}

const CAMPAIGNS = [{ name: 'DRYOFF' }, { name: 'Solbiot' }]

function loadDocumentBuilderService() {
  const serviceMod = require.resolve('../services/documentBuilderService')
  delete require.cache[serviceMod]
  return require('../services/documentBuilderService')
}

function withReadableCompany(companyId, fn) {
  const resolveMod = require.resolve('../lib/resolveReadableCompanyId')
  const serviceMod = require.resolve('../services/documentBuilderService')
  const prevResolve = require(resolveMod)
  require.cache[resolveMod].exports = {
    resolveReadableCompanyId: async () => ({ ok: true, companyId })
  }
  const api = loadDocumentBuilderService()
  return fn(api).finally(() => {
    require.cache[resolveMod].exports = prevResolve
    delete require.cache[serviceMod]
  })
}

function chainable(endValue, hooks = {}) {
  const chain = {
    join() {
      return chain
    },
    select() {
      return chain
    },
    where() {
      return chain
    },
    whereNotIn() {
      return chain
    },
    whereRaw() {
      return chain
    },
    orderBy() {
      return chain
    },
    first: async () => {
      if (hooks.onFirst) hooks.onFirst()
      return endValue
    },
    insert(payload) {
      return {
        returning: async () => {
          if (hooks.onInsert) hooks.onInsert(payload)
          return [
            {
              id: '77777777-7777-7777-7777-777777777777',
              file_name: 'plantilla_11_111_111_1.pdf',
              gcs_path: 'contratos/test.pdf',
              status: 'draft'
            }
          ]
        }
      }
    },
    delete: async () => 1
  }
  return chain
}

function createGenerateDb({ templateDoc = null, hooks = {} } = {}) {
  const contentJson = templateDoc ?? {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contrato sin variables.' }] }]
  }
  return function db(table) {
    if (table === 'company') {
      return chainable({ id: COMPANY_ID, business_name: 'Empresa Test' })
    }
    if (table === 'template as t') {
      return chainable({
        id: TEMPLATE_ID,
        code: 'CT-001',
        name: 'Plantilla',
        description: '',
        content_json: contentJson
      })
    }
    if (table === 'draft_document') {
      return chainable(null, hooks)
    }
    throw new Error(`Unexpected table: ${table}`)
  }
}

function baseGenerateArgs(bodyExtra = {}) {
  return {
    userId: USER_ID,
    requestedCompanyId: COMPANY_ID,
    body: {
      supplierId: SUPPLIER_ID,
      template: { kind: 'standard', id: TEMPLATE_ID },
      ...bodyExtra
    }
  }
}

function paraDoc(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
  }
}

function stubGcs({ onUpload } = {}) {
  return {
    uploadBuffer: async () => {
      if (onUpload) onUpload()
    },
    downloadBuffer: async () => Buffer.alloc(0),
    deleteFile: async () => {}
  }
}

function campaignClient(productCampaigns) {
  return {
    getClientById: async () => ({
      ok: true,
      data: {
        client: {
          id: CLIENT_ID,
          name: 'Laboratorio Chile',
          brand: 'Marca',
          product_campaigns: productCampaigns
        }
      }
    })
  }
}

async function runGenerate({ templateDoc, supplier = SUPPLIER, clientService, bodyExtra, onUpload, onInsert }) {
  return withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc, hooks: { onInsert } }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier } }) },
      clientService,
      gcsService: stubGcs({ onUpload }),
      getUserProfileIdByUserId: async () => PROFILE_ID
    })
    return service.generateAndPersist(baseGenerateArgs(bodyExtra))
  })
}

const CAMPAIGN_DOC = paraDoc('Campaña: {{client_product_campaign}}')
const REEL_DOC = paraDoc('{{cantidad_reels}} {{formato_reel}} en {{lugar_contrato}}')
const SOCIAL_DOC = paraDoc('Red: {{proveedor_red_social}} @{{proveedor_cuenta_social}}')

test('client_product_campaign in catalog is accepted', async () => {
  const result = await runGenerate({
    templateDoc: CAMPAIGN_DOC,
    clientService: campaignClient(CAMPAIGNS),
    bodyExtra: {
      dryRun: true,
      clientId: CLIENT_ID,
      missingFieldOverrides: { client_product_campaign: 'Solbiot' }
    }
  })
  assert.equal(result.ok, true)
})

test('client_product_campaign outside catalog is rejected without echoing the value', async () => {
  let uploadCalled = false
  let insertCalled = false
  const result = await runGenerate({
    templateDoc: CAMPAIGN_DOC,
    clientService: campaignClient(CAMPAIGNS),
    onUpload: () => {
      uploadCalled = true
    },
    onInsert: () => {
      insertCalled = true
    },
    bodyExtra: {
      clientId: CLIENT_ID,
      missingFieldOverrides: { client_product_campaign: 'Producto Inventado' }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.match(result.message, /Producto\/Campaña/)
  assert.match(result.message, /DRYOFF/)
  assert.match(result.message, /Solbiot/)
  assert.equal(result.message.includes('Producto Inventado'), false)
  assert.equal(uploadCalled, false)
  assert.equal(insertCalled, false)
})

test('client_product_campaign with different casing is rejected', async () => {
  const result = await runGenerate({
    templateDoc: CAMPAIGN_DOC,
    clientService: campaignClient(CAMPAIGNS),
    bodyExtra: {
      dryRun: true,
      clientId: CLIENT_ID,
      missingFieldOverrides: { client_product_campaign: 'Dryoff' }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.match(result.message, /DRYOFF/)
  assert.match(result.message, /Solbiot/)
  assert.equal(result.message.includes('Dryoff'), false)
})

test('client_product_campaign dry-run rejects out-of-catalog the same as generate', async () => {
  const result = await runGenerate({
    templateDoc: CAMPAIGN_DOC,
    clientService: campaignClient(CAMPAIGNS),
    bodyExtra: {
      dryRun: true,
      clientId: CLIENT_ID,
      missingFieldOverrides: { client_product_campaign: 'Producto Inventado' }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('client_product_campaign without catalog is not rejected', async () => {
  const noClient = await runGenerate({
    templateDoc: CAMPAIGN_DOC,
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: { client_product_campaign: 'Campaña Libre' }
    }
  })
  assert.equal(noClient.ok, true)

  const emptyCampaigns = await runGenerate({
    templateDoc: CAMPAIGN_DOC,
    clientService: campaignClient([]),
    bodyExtra: {
      dryRun: true,
      clientId: CLIENT_ID,
      missingFieldOverrides: { client_product_campaign: 'Campaña Libre' }
    }
  })
  assert.equal(emptyCampaigns.ok, true)
})

test('formato_reel catalog value is accepted then formatted', async () => {
  let inserted = null
  const result = await runGenerate({
    templateDoc: REEL_DOC,
    onInsert: (payload) => {
      inserted = payload
    },
    bodyExtra: {
      missingFieldOverrides: {
        formato_reel: 'Video',
        cantidad_reels: '3',
        lugar_contrato: 'Santiago'
      }
    }
  })
  assert.equal(result.ok, true)
  assert.equal(inserted.contract_overrides.formato_reel, 'videos')
})

test('formato_reel outside catalog is rejected', async () => {
  const result = await runGenerate({
    templateDoc: REEL_DOC,
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: { formato_reel: 'Publicación', lugar_contrato: 'Santiago' }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.match(result.message, /Formato de reel/)
  assert.match(result.message, /Reel/)
  assert.match(result.message, /Video/)
  assert.match(result.message, /Historia/)
  assert.match(result.message, /Story/)
  assert.match(result.message, /Post/)
  assert.match(result.message, /Carrusel/)
  assert.match(result.message, /Short/)
  assert.equal(result.message.includes('Publicación'), false)
})

test('formato_reel different casing is rejected', async () => {
  const result = await runGenerate({
    templateDoc: REEL_DOC,
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: { formato_reel: 'video', lugar_contrato: 'Santiago' }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.match(result.message, /Video/)
})

test('non-select override is not catalog-checked', async () => {
  const result = await runGenerate({
    templateDoc: paraDoc('Lugar: {{lugar_contrato}}'),
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: { lugar_contrato: 'cualquier texto' }
    }
  })
  assert.equal(result.ok, true)
})

test('matching social pair is accepted', async () => {
  const supplier = {
    ...SUPPLIER,
    social_networks: [
      { name: 'Instagram', account_name: '@marca' },
      { name: 'TikTok', account_name: '@otra' }
    ]
  }
  const result = await runGenerate({
    templateDoc: SOCIAL_DOC,
    supplier,
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: {
        proveedor_red_social: 'Instagram',
        proveedor_cuenta_social: '@marca'
      }
    }
  })
  assert.equal(result.ok, true)
})

test('crossed social pair is rejected', async () => {
  const supplier = {
    ...SUPPLIER,
    social_networks: [
      { name: 'Instagram', account_name: '@marca' },
      { name: 'TikTok', account_name: '@otra' }
    ]
  }
  let uploadCalled = false
  const result = await runGenerate({
    templateDoc: SOCIAL_DOC,
    supplier,
    onUpload: () => {
      uploadCalled = true
    },
    bodyExtra: {
      missingFieldOverrides: {
        proveedor_red_social: 'Instagram',
        proveedor_cuenta_social: '@otra'
      }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.match(result.message, /Red Social/)
  assert.match(result.message, /Instagram — @marca/)
  assert.match(result.message, /TikTok — @otra/)
  assert.equal(result.message.includes('Instagram — @otra'), false)
  assert.equal(uploadCalled, false)
})

test('unknown social network is rejected', async () => {
  const supplier = {
    ...SUPPLIER,
    social_networks: [{ name: 'Instagram', account_name: '@marca' }]
  }
  const result = await runGenerate({
    templateDoc: SOCIAL_DOC,
    supplier,
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: { proveedor_red_social: 'Facebook' }
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.match(result.message, /Instagram — @marca/)
  assert.equal(result.message.includes('Facebook'), false)
})

test('supplier without social networks keeps free text', async () => {
  const result = await runGenerate({
    templateDoc: SOCIAL_DOC,
    bodyExtra: {
      dryRun: true,
      missingFieldOverrides: {
        proveedor_red_social: 'Instagram',
        proveedor_cuenta_social: '@libre'
      }
    }
  })
  assert.equal(result.ok, true)
})
