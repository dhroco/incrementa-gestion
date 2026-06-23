const test = require('node:test')
const assert = require('node:assert/strict')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'

const DOC_WITH_PLACEHOLDER = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hola {{variable_inexistente_xyz}}' }]
    }
  ]
}

const SUPPLIER = {
  supplier_type: 'persona_natural',
  full_name: 'Juan Pérez',
  rut_display: '11.111.111-1',
  address: 'Calle 1'
}

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
    insert() {
      return {
        returning: async () => {
          if (hooks.onInsert) hooks.onInsert()
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
    delete: async () => {
      if (hooks.onDelete) hooks.onDelete()
      return 1
    }
  }
  return chain
}

function createGenerateDb({ duplicateRow = null, templateDoc = null, hooks = {} } = {}) {
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
      return chainable(duplicateRow, hooks)
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

test('generateAndPersist dryRun succeeds without GCS or DB writes', async () => {
  let uploadCalled = false
  let duplicateLookupCalled = false

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({
        duplicateRow: null,
        hooks: {
          onFirst: () => {
            duplicateLookupCalled = true
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {
          uploadCalled = true
        },
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, true)
    assert.equal(result.data.valid, true)
    assert.equal(uploadCalled, false)
    assert.equal(duplicateLookupCalled, false)
  })
})

test('generateAndPersist dryRun returns MISSING_PLACEHOLDERS without persisting', async () => {
  let uploadCalled = false

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: DOC_WITH_PLACEHOLDER }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {
          uploadCalled = true
        },
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, false)
    assert.equal(result.code, 'MISSING_PLACEHOLDERS')
    assert.ok(Array.isArray(result.data.missingFields))
    assert.equal(result.data.missingFields[0].key, 'variable_inexistente_xyz')
    assert.equal(result.data.missingFields[0].type, 'text')
    assert.equal(uploadCalled, false)
  })
})

test('generateAndPersist dryRun returns enriched missingFields for known variables', async () => {
  const docWithKnownVar = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Firma en {{lugar_contrato}} el {{fecha_contrato}}' }]
      }
    ]
  }

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: docWithKnownVar }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, false)
    assert.equal(result.code, 'MISSING_PLACEHOLDERS')
    const fields = result.data.missingFields
    assert.ok(Array.isArray(fields))
    const city = fields.find((f) => f.key === 'lugar_contrato')
    const date = fields.find((f) => f.key === 'fecha_contrato')
    assert.equal(city.label, 'Lugar del contrato')
    assert.equal(city.type, 'text')
    assert.equal(date.label, 'Fecha del contrato')
    assert.equal(date.type, 'date')
  })
})

test('generateAndPersist dryRun maps precio_texto missing to precio_numero', async () => {
  const docWithPrice = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Precio: {{precio_numero}} ({{precio_texto}})' }]
      }
    ]
  }

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: docWithPrice }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, false)
    const fields = result.data.missingFields
    assert.equal(fields.length, 1)
    assert.equal(fields[0].key, 'precio_numero')
    assert.equal(fields[0].pairField, 'precio_texto')
    assert.equal(fields[0].type, 'number')
  })
})

test('generateAndPersist preprocesses numeric overrides and generates precio_texto', async () => {
  const docWithPrice = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Total {{precio_numero}} — {{precio_texto}}' }]
      }
    ]
  }

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: docWithPrice }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(
      baseGenerateArgs({
        dryRun: true,
        missingFieldOverrides: { precio_numero: '1500000' }
      })
    )

    assert.equal(result.ok, true)
    assert.equal(result.data.valid, true)
  })
})

test('generateAndPersist missingFields includes supplier social network options', async () => {
  const docWithSocial = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Red: {{proveedor_red_social}} @{{proveedor_cuenta_social}}' }]
      }
    ]
  }
  const supplierWithNetworks = {
    ...SUPPLIER,
    social_networks: [{ name: 'Instagram', account_name: '@mihandle' }]
  }

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: docWithSocial }),
      supplierService: {
        getSupplierById: async () => ({ ok: true, data: { supplier: supplierWithNetworks } })
      },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, false)
    const field = result.data.missingFields.find((f) => f.key === 'proveedor_red_social')
    assert.equal(field.type, 'select')
    assert.equal(field.pairField, 'proveedor_cuenta_social')
    assert.equal(field.options.length, 1)
    assert.equal(field.options[0].label, 'Instagram — @mihandle')
    assert.deepEqual(field.options[0].values, {
      proveedor_red_social: 'Instagram',
      proveedor_cuenta_social: '@mihandle'
    })
  })
})

test('generateAndPersist missingFields falls back to text when supplier has no social networks', async () => {
  const docWithSocial = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Red: {{proveedor_red_social}}' }]
      }
    ]
  }

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: docWithSocial }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, false)
    const field = result.data.missingFields.find((f) => f.key === 'proveedor_red_social')
    assert.equal(field.type, 'text')
  })
})

test('generateAndPersist missingFields includes client campaign options', async () => {
  const docWithCampaign = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Campaña: {{client_product_campaign}}' }]
      }
    ]
  }
  const CLIENT_ID = '99999999-9999-9999-9999-999999999999'

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ templateDoc: docWithCampaign }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      clientService: {
        getClientById: async () => ({
          ok: true,
          data: {
            client: {
              id: CLIENT_ID,
              name: 'Cliente',
              brand: 'Marca',
              product_campaigns: [{ name: 'Verano 2026' }, { name: 'Black Friday' }]
            }
          }
        })
      },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(
      baseGenerateArgs({ dryRun: true, clientId: CLIENT_ID })
    )

    assert.equal(result.ok, false)
    const field = result.data.missingFields.find((f) => f.key === 'client_product_campaign')
    assert.equal(field.label, 'Producto/Campaña')
    assert.equal(field.type, 'select')
    assert.deepEqual(field.options, ['Verano 2026', 'Black Friday'])
  })
})

test('generateAndPersist dryRun skips DUPLICATE_DRAFT check', async () => {
  const duplicate = {
    id: '88888888-8888-8888-8888-888888888888',
    file_name: 'prev.pdf',
    gcs_path: 'contratos/prev.pdf',
    created_at: new Date('2026-05-15T12:00:00.000Z'),
    status: 'draft'
  }
  let uploadCalled = false
  let duplicateLookupCalled = false

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({
        duplicateRow: duplicate,
        hooks: {
          onFirst: () => {
            duplicateLookupCalled = true
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {
          uploadCalled = true
        },
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ dryRun: true }))

    assert.equal(result.ok, true)
    assert.equal(result.data.valid, true)
    assert.equal(uploadCalled, false)
    assert.equal(duplicateLookupCalled, false)
  })
})
