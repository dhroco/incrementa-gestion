const test = require('node:test')
const assert = require('node:assert/strict')

const resolveMod = require.resolve('../lib/resolveReadableCompanyId')
const serviceMod = require.resolve('../services/documentBuilderService')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'

const STATIC_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contrato sin variables.' }] }]
}

const SUPPLIER = {
  supplier_type: 'persona_natural',
  country_code: 'CL',
  full_name: 'Juan Pérez',
  document_display: '11.111.111-1',
  address: 'Calle 1'
}

const { preprocessMissingFieldOverrides } = require('../services/documentBuilderService')

function loadDocumentBuilderService() {
  delete require.cache[serviceMod]
  return require('../services/documentBuilderService')
}

function withReadableCompany(companyId, fn) {
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
    delete: async () => {
      if (hooks.onDelete) hooks.onDelete()
      return 1
    }
  }
  return chain
}

function createGenerateDb({ hooks = {}, currencyCode = 'CLP', countryCode = 'CL' } = {}) {
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
        content_json: STATIC_DOC,
        country_code: countryCode,
        currency_code: currencyCode
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

function gcsService() {
  return {
    uploadBuffer: async () => {},
    downloadBuffer: async () => Buffer.alloc(0),
    deleteFile: async () => {}
  }
}

const CLP_CELLS = [
  ['1290', '$1.290'],
  ['1500000', '$1.500.000'],
  ['0', '$0']
]

const USD_CELLS = [
  ['1290', 'US$1,290'],
  ['1500000', 'US$1,500,000'],
  ['0', 'US$0']
]

test('CLP price cells', () => {
  for (const [raw, expected] of CLP_CELLS) {
    assert.equal(
      preprocessMissingFieldOverrides({ precio_numero: raw }, { currencyCode: 'CLP' }).precio_numero,
      expected
    )
    assert.equal(preprocessMissingFieldOverrides({ precio_numero: raw }).precio_numero, expected)
    assert.equal(
      preprocessMissingFieldOverrides({ precio_numero: raw }, { currencyCode: null }).precio_numero,
      expected
    )
    assert.equal(
      preprocessMissingFieldOverrides({ precio_numero: raw }, { currencyCode: '' }).precio_numero,
      expected
    )
  }
})

test('USD price cells', () => {
  for (const [raw, expected] of USD_CELLS) {
    assert.equal(
      preprocessMissingFieldOverrides({ precio_numero: raw }, { currencyCode: 'USD' }).precio_numero,
      expected
    )
  }
})

test('Price text ignores currency', () => {
  for (const currencyCode of ['CLP', 'USD']) {
    const out = preprocessMissingFieldOverrides({ precio_numero: '1290' }, { currencyCode })
    assert.equal(out.precio_texto, 'mil doscientos noventa')
  }
})

test('Unknown currency throws', () => {
  assert.throws(
    () => preprocessMissingFieldOverrides({ precio_numero: '1290' }, { currencyCode: 'MXN' }),
    Error
  )
})

test('Price number formatted and text generated', () => {
  const out = preprocessMissingFieldOverrides({ precio_numero: '1500000' })
  assert.equal(out.precio_numero, '$1.500.000')
  assert.ok(out.precio_texto)
  assert.notEqual(String(out.precio_texto).trim(), '')
})

test('USD template stores US dollar price', async () => {
  let inserted = null

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({
        currencyCode: 'USD',
        countryCode: 'CL',
        hooks: {
          onInsert: (payload) => {
            inserted = payload
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: gcsService(),
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(
      baseGenerateArgs({ missingFieldOverrides: { precio_numero: '1290' } })
    )

    assert.equal(result.ok, true)
    assert.equal(inserted.contract_overrides.precio_numero, 'US$1,290')
  })
})

test('CLP template stores Chilean price', async () => {
  let inserted = null

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({
        currencyCode: 'CLP',
        countryCode: 'CL',
        hooks: {
          onInsert: (payload) => {
            inserted = payload
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: gcsService(),
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(
      baseGenerateArgs({ missingFieldOverrides: { precio_numero: '1290' } })
    )

    assert.equal(result.ok, true)
    assert.equal(inserted.contract_overrides.precio_numero, '$1.290')
  })
})

test('Unknown currency names the rejected code', () => {
  assert.throws(
    () => preprocessMissingFieldOverrides({ precio_numero: '1290' }, { currencyCode: 'MXN' }),
    (err) =>
      err instanceof Error &&
      !(err instanceof TypeError) &&
      err.message === 'Moneda de plantilla no admitida: MXN.'
  )
})

test('Whitespace currency falls back to CLP', () => {
  assert.equal(
    preprocessMissingFieldOverrides({ precio_numero: '1290' }, { currencyCode: '   ' }).precio_numero,
    '$1.290'
  )
})

test('getTemplateRow selects template currency_code', async () => {
  const selected = []

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const inner = createGenerateDb({ currencyCode: 'USD', countryCode: 'CL' })
    function db(table) {
      const chain = inner(table)
      if (table === 'template as t') {
        const select = chain.select.bind(chain)
        chain.select = (...columns) => {
          selected.push(columns.flat())
          return select(...columns)
        }
      }
      return chain
    }

    const service = createDocumentBuilderService({
      db,
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: gcsService(),
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(
      baseGenerateArgs({ missingFieldOverrides: { precio_numero: '1290' } })
    )
    assert.equal(result.ok, true)
  })

  assert.ok(selected.some((columns) => columns.includes('t.currency_code')))
})
