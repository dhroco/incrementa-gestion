const test = require('node:test')
const assert = require('node:assert/strict')

const resolveMod = require.resolve('../lib/resolveReadableCompanyId')
const serviceMod = require.resolve('../services/documentBuilderService')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'

const PRICE_MESSAGE =
  'El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.'

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

const { parsePriceInput, preprocessMissingFieldOverrides } = require('../services/documentBuilderService')

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

function gcsService(hooks = {}) {
  return {
    uploadBuffer: async () => {
      if (hooks.onUpload) hooks.onUpload()
    },
    downloadBuffer: async () => Buffer.alloc(0),
    deleteFile: async () => {}
  }
}

test('Plain integers are accepted', () => {
  assert.deepEqual(parsePriceInput('1290'), { ok: true, value: 1290 })
  assert.deepEqual(parsePriceInput('0'), { ok: true, value: 0 })
  assert.deepEqual(parsePriceInput('1500000'), { ok: true, value: 1500000 })
})

test('Dot-grouped thousands are accepted', () => {
  assert.deepEqual(parsePriceInput('1.290'), { ok: true, value: 1290 })
  assert.deepEqual(parsePriceInput('1.500.000'), { ok: true, value: 1500000 })
  assert.deepEqual(parsePriceInput('12.345'), { ok: true, value: 12345 })
})

test('Comma-grouped thousands are accepted', () => {
  assert.deepEqual(parsePriceInput('1,290'), { ok: true, value: 1290 })
  assert.deepEqual(parsePriceInput('1,500,000'), { ok: true, value: 1500000 })
})

test('Surrounding whitespace is trimmed', () => {
  assert.deepEqual(parsePriceInput(' 1290 '), { ok: true, value: 1290 })
})

test('A numeric value is accepted', () => {
  assert.deepEqual(parsePriceInput(1290), { ok: true, value: 1290 })
})

test('Decimals, mixed separators, bad groups, and symbols are rejected', () => {
  assert.deepEqual(parsePriceInput('1,290.50'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1290.50'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1290,5'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('12,5'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1.29'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1.290,000'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1,290.000'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1.2900'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('12.90'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('.290'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1.'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1..290'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('$1290'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('US$1,290'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('290 USD'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('1 290'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('-1290'), { ok: false, message: PRICE_MESSAGE })
  assert.deepEqual(parsePriceInput('abc'), { ok: false, message: PRICE_MESSAGE })
})

test('Comma-grouped USD price is formatted', () => {
  const out = preprocessMissingFieldOverrides({ precio_numero: '1,290' }, { currencyCode: 'USD' })
  assert.equal(out.precio_numero, 'US$1,290')
  assert.equal(out.precio_texto, 'mil doscientos noventa')
})

test('Dot-grouped CLP price is formatted', () => {
  const out = preprocessMissingFieldOverrides({ precio_numero: '1.290' }, { currencyCode: 'CLP' })
  assert.equal(out.precio_numero, '$1.290')
})

test('Invalid price is left unchanged', () => {
  for (const currencyCode of ['CLP', 'USD']) {
    const out = preprocessMissingFieldOverrides({ precio_numero: '1290.50' }, { currencyCode })
    assert.equal(out.precio_numero, '1290.50')
    assert.equal(Object.hasOwn(out, 'precio_texto'), false)
  }
})

async function generatePrice({ precioNumero, dryRun = false, currencyCode = 'CLP' }) {
  let inserted = null
  let uploads = 0
  let result

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({
        currencyCode,
        countryCode: 'CL',
        hooks: {
          onInsert: (payload) => {
            inserted = payload
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: gcsService({
        onUpload: () => {
          uploads += 1
        }
      }),
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const bodyExtra = { missingFieldOverrides: { precio_numero: precioNumero } }
    if (dryRun) bodyExtra.dryRun = true

    result = await service.generateAndPersist(baseGenerateArgs(bodyExtra))
  })

  return { result, inserted, uploads }
}

test('Dry run rejects a price that is not a clean integer', async () => {
  const { result, inserted, uploads } = await generatePrice({
    precioNumero: '1,290.50',
    dryRun: true
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(result.message, PRICE_MESSAGE)
  assert.equal(inserted, null)
  assert.equal(uploads, 0)
})

test('Real generate rejects a price that is not a clean integer', async () => {
  const { result, inserted, uploads } = await generatePrice({
    precioNumero: '1,290.50'
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(result.message, PRICE_MESSAGE)
  assert.equal(inserted, null)
  assert.equal(uploads, 0)
})

test('Grouped USD price is stored formatted', async () => {
  const { result, inserted } = await generatePrice({
    precioNumero: '1,290',
    currencyCode: 'USD'
  })

  assert.equal(result.ok, true)
  assert.equal(inserted.contract_overrides.precio_numero, 'US$1,290')
})
