const test = require('node:test')
const assert = require('node:assert/strict')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'
const REVIEW_ID = '88888888-8888-8888-8888-888888888888'

const SUPPLIER = {
  supplier_type: 'persona_natural',
  country_code: 'CL',
  full_name: 'Ana Soto',
  document_display: '76.543.210-K',
  address: 'Pasaje Los Aromos 900',
  social_networks: [{ name: 'TikTok', account_name: '@ana' }]
}

function text(value) {
  return { type: 'text', text: value }
}

function variable(id) {
  return { type: 'variable', attrs: { variableId: id } }
}

function paragraph(content) {
  return { type: 'paragraph', content }
}

const DYNAMIC_DOC = {
  type: 'doc',
  content: [
    paragraph([text('SEGUNDO. De los servicios.')]),
    paragraph([
      text('2.3 En concreto, los Servicios comprenden '),
      variable('servicios_entregables'),
      text('.')
    ]),
    paragraph([text('TERCERO. Del precio.')])
  ]
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

function chainable(endValue) {
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
    first: async () => endValue,
    insert() {
      return { returning: async () => [{ id: '77777777-7777-7777-7777-777777777777' }] }
    },
    delete: async () => 1
  }
  return chain
}

function createDb(reviews) {
  function db(table) {
    if (table === 'company') {
      return chainable({ id: COMPANY_ID, business_name: 'Empresa Test' })
    }
    if (table === 'template as t') {
      return chainable({
        id: TEMPLATE_ID,
        code: 'CT-001',
        name: 'Plantilla',
        description: '',
        content_json: DYNAMIC_DOC,
        country_code: 'CL',
        currency_code: 'CLP'
      })
    }
    if (table === 'draft_document') return chainable(null)
    if (table === 'contract_review') {
      return {
        insert(payload) {
          const row = { id: REVIEW_ID, ...payload }
          reviews.push(row)
          return { returning: async () => [{ id: row.id }] }
        },
        where() {
          return { first: async () => null }
        }
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  }
  return db
}

test('A dry run body still reviews', async () => {
  const reviews = []
  let calls = 0
  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createDb(reviews),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID,
      contractReviewer: {
        isReviewerConfigured: () => true,
        review: async () => {
          calls += 1
          return { verdict: 'ok', observations: [], model: 'claude-opus-5' }
        }
      }
    })
    const result = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: {
        dryRun: true,
        supplierId: SUPPLIER_ID,
        template: { kind: 'standard', id: TEMPLATE_ID },
        missingFieldOverrides: {
          servicios_entregables: 'cinco (5) reels en TikTok'
        }
      }
    })
    assert.equal(result.ok, true)
    assert.equal(result.data.valid, undefined)
    assert.equal(result.data.verdict, 'ok')
    assert.equal(result.data.reviewId, REVIEW_ID)
    assert.equal(calls, 1)
    assert.equal(reviews.length, 1)
  })
})
