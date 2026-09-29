const test = require('node:test')
const assert = require('node:assert/strict')
const { prepareValue } = require('pg/lib/utils')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'
const REVIEW_ID = '88888888-8888-8888-8888-888888888888'

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    paragraph([text('2.5 Las cuentas son '), variable('cuentas_publicacion'), text('.')]),
    paragraph([text('TERCERO. Del precio.')])
  ]
}

const OBSERVATION = {
  dynamicTextId: 'servicios_entregables',
  clause: '2.3',
  problem: 'Falta la cifra.',
  suggestion: 'cinco (5) reels en TikTok'
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
    first: async () => endValue,
    insert(payload) {
      return {
        returning: async () => {
          if (hooks.onInsert) hooks.onInsert(payload)
          return [{ id: '77777777-7777-7777-7777-777777777777', file_name: 'plantilla.pdf', gcs_path: 'contratos/test.pdf', status: 'draft' }]
        }
      }
    },
    delete: async () => 1
  }
  return chain
}

function createDb({ reviews, hooks }) {
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
    if (table === 'draft_document') {
      return chainable(null, hooks)
    }
    if (table === 'contract_review') {
      return {
        insert(payload) {
          const row = { id: REVIEW_ID, ...payload }
          reviews.push(row)
          return { returning: async () => [{ id: row.id }] }
        },
        where(criteria) {
          if (!UUID_TEXT.test(String(criteria.id ?? ''))) {
            const err = new Error(`invalid input syntax for type uuid: "${criteria.id}"`)
            err.code = '22P02'
            throw err
          }
          return {
            first: async () =>
              reviews.find(
                (row) =>
                  row.id === criteria.id &&
                  row.company_id === criteria.company_id &&
                  row.supplier_id === criteria.supplier_id &&
                  row.template_id === criteria.template_id &&
                  row.input_hash === criteria.input_hash
              ) ?? null
          }
        }
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  }
  return db
}

function baseBody(extra = {}) {
  return {
    supplierId: SUPPLIER_ID,
    template: { kind: 'standard', id: TEMPLATE_ID },
    missingFieldOverrides: {
      servicios_entregables: 'cinco (5) reels en TikTok',
      cuentas_publicacion: 'su cuenta de TikTok @ana'
    },
    ...extra
  }
}

function reviewerReturning(observations) {
  return {
    isReviewerConfigured: () => true,
    review: async () => ({
      verdict: observations.length > 0 ? 'observaciones' : 'ok',
      observations,
      model: 'claude-opus-5'
    })
  }
}

async function withService(reviewer, fn) {
  const reviews = []
  const hooks = { inserted: null, uploaded: false, onInsert: null }
  hooks.onInsert = (payload) => {
    hooks.inserted = payload
  }
  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createDb({ reviews, hooks }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {
          hooks.uploaded = true
        },
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID,
      contractReviewer: reviewer
    })
    await fn({ service, reviews, hooks })
  })
}

function assertJsonbArray(stored, expected) {
  assert.equal(typeof stored, 'string')
  const bound = prepareValue(stored)
  assert.equal(bound, JSON.stringify(expected))
  const parsed = JSON.parse(bound)
  assert.ok(Array.isArray(parsed))
  assert.deepEqual(parsed, expected)
}

test('An empty observation list is stored as a jsonb array', async () => {
  await withService(reviewerReturning([]), async ({ service, reviews }) => {
    const result = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: baseBody()
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.data.observations, [])
    assert.equal(reviews.length, 1)
    assertJsonbArray(reviews[0].observations, [])
  })
})

test('Observations are stored as a jsonb array and Generar igual still finds the row', async () => {
  await withService(reviewerReturning([OBSERVATION]), async ({ service, reviews, hooks }) => {
    const body = baseBody()
    const reviewed = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    assert.equal(reviewed.ok, true)
    assert.deepEqual(reviewed.data.observations, [OBSERVATION])
    assert.equal(reviews.length, 1)
    assertJsonbArray(reviews[0].observations, [OBSERVATION])

    const generated = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: {
        ...body,
        reviewId: reviewed.data.reviewId,
        generarIgual: { motivo: 'acepto el texto' }
      }
    })
    assert.equal(generated.ok, true)
    assert.equal(hooks.inserted.review_id, REVIEW_ID)
    assert.equal(hooks.inserted.review_override_reason, 'acepto el texto')
  })
})

test('A reviewId that is not a uuid is REVIEW_REQUIRED', async () => {
  await withService(reviewerReturning([]), async ({ service, hooks }) => {
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: baseBody({ reviewId: 'no-es-uuid' })
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 409)
    assert.equal(result.code, 'REVIEW_REQUIRED')
    assert.equal(result.message, 'Revisa la redacción antes de generar: no hay una revisión de los textos actuales.')
    assert.equal(hooks.uploaded, false)
    assert.equal(hooks.inserted, null)
  })
})
