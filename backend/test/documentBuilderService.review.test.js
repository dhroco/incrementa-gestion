const test = require('node:test')
const assert = require('node:assert/strict')
const { formatFechaEs } = require('../utils/formatFechaEs')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'
const REVIEW_ID = '88888888-8888-8888-8888-888888888888'

const RUT = '76.543.210-K'
const ADDRESS = 'Pasaje Los Aromos 900'
const PRICE = '1290'
const FORMATTED_PRICE = '$1.290'

const SUPPLIER = {
  supplier_type: 'persona_natural',
  country_code: 'CL',
  full_name: 'Ana Soto',
  document_display: RUT,
  address: ADDRESS,
  social_networks: [
    { name: 'TikTok', account_name: '@ana' },
    { name: 'Instagram', account_name: null }
  ]
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
    paragraph([text('PRIMERO. Antecedentes.')]),
    paragraph([text('SEGUNDO. De los servicios.')]),
    paragraph([
      text('2.3 En concreto, los Servicios comprenden '),
      variable('servicios_entregables'),
      text('.')
    ]),
    paragraph([
      text('2.5 Las cuentas son '),
      variable('cuentas_publicacion'),
      text('.')
    ]),
    paragraph([
      text('El mes es '),
      variable('mes_ejecucion'),
      text(' y la fecha es '),
      variable('fecha_contrato'),
      text('.')
    ]),
    paragraph([text('TERCERO. Del precio.')]),
    paragraph([
      text('El precio es '),
      variable('precio_numero'),
      text(' ('),
      variable('precio_texto'),
      text(').')
    ])
  ]
}

const PLAIN_DOC = {
  type: 'doc',
  content: [paragraph([text('Contrato sin variables.')])]
}

const FALLBACK_DOC = {
  type: 'doc',
  content: [
    paragraph([
      text('2.3 En concreto, los Servicios comprenden '),
      variable('servicios_entregables'),
      text('.')
    ]),
    paragraph([text('2.5 Las cuentas son '), variable('cuentas_publicacion'), text('.')]),
    paragraph([text('3.1 El precio es '), variable('precio_numero'), text('.')])
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
              file_name: 'plantilla.pdf',
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

function createDb({ templateDoc, reviews, hooks = {} } = {}) {
  const contentJson = templateDoc ?? PLAIN_DOC
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
        content_json: contentJson,
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
          return {
            returning: async () => [{ id: row.id }]
          }
        },
        where(criteria) {
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
      cuentas_publicacion: 'su cuenta de TikTok @ana',
      mes_ejecucion: 'marzo de 2026',
      fecha_contrato: '2026-03-15',
      precio_numero: PRICE
    },
    ...extra
  }
}

function okReviewer(capture) {
  return {
    isReviewerConfigured: () => true,
    review: async (input) => {
      if (capture) capture.input = input
      return { verdict: 'ok', observations: [], model: 'claude-opus-5' }
    }
  }
}

async function withService({ templateDoc, reviewer, body } = {}, fn) {
  const reviews = []
  const hooks = { inserted: null, uploaded: false }
  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createDb({
        templateDoc,
        reviews,
        hooks: {
          onInsert: (payload) => {
            hooks.inserted = payload
          }
        }
      }),
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
    await fn({ service, reviews, hooks, body: body ?? baseBody() })
  })
}

function snapshotText(doc) {
  const parts = []
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(doc)
  return parts.join('')
}

test('A review row is stored and the payload has no RUT, address, or price', async () => {
  const capture = {}
  await withService({ templateDoc: DYNAMIC_DOC, reviewer: okReviewer(capture) }, async ({ service, reviews, body }) => {
    const result = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    assert.equal(result.ok, true)
    assert.equal(result.data.verdict, 'ok')
    assert.equal(result.data.reviewId, REVIEW_ID)
    assert.equal(reviews.length, 1)
    assert.equal(reviews[0].input_hash.length, 64)
    assert.equal(reviews[0].reviewed_text, capture.input.sectionText)
    assert.equal(reviews[0].model, 'claude-opus-5')
    assert.equal(reviews[0].company_id, COMPANY_ID)
    assert.equal(reviews[0].supplier_id, SUPPLIER_ID)
    assert.equal(reviews[0].template_id, TEMPLATE_ID)
    assert.equal(reviews[0].created_by, PROFILE_ID)
    assert.equal(reviews[0].verdict, 'ok')

    assert.deepEqual(Object.keys(capture.input), ['sectionText', 'dynamicTexts', 'datos'])
    assert.deepEqual(Object.keys(capture.input.datos), [
      'redesDelProveedor',
      'mes_ejecucion',
      'fecha_contrato'
    ])
    assert.deepEqual(capture.input.datos.redesDelProveedor, [
      { red: 'TikTok', cuenta: '@ana' },
      { red: 'Instagram', cuenta: null }
    ])
    assert.equal(capture.input.datos.mes_ejecucion, 'marzo de 2026')
    assert.equal(capture.input.datos.fecha_contrato, formatFechaEs('2026-03-15'))
    assert.deepEqual(
      capture.input.dynamicTexts.map((item) => item.id),
      ['servicios_entregables', 'cuentas_publicacion']
    )
    assert.equal(capture.input.dynamicTexts[0].value, 'cinco (5) reels en TikTok')
    assert.ok(capture.input.dynamicTexts[0].instruccion)
    assert.ok(capture.input.sectionText.includes('SEGUNDO'))
    assert.equal(capture.input.sectionText.includes('TERCERO'), false)

    const packed = JSON.stringify(capture.input)
    assert.equal(packed.includes(RUT), false)
    assert.equal(packed.includes(ADDRESS), false)
    assert.equal(packed.includes(PRICE), false)
    assert.equal(packed.includes(FORMATTED_PRICE), false)
  })
})

test('A template without dynamic text is not reviewed', async () => {
  let calls = 0
  const reviewer = {
    isReviewerConfigured: () => true,
    review: async () => {
      calls += 1
      return { verdict: 'ok', observations: [], model: 'claude-opus-5' }
    }
  }
  await withService({ templateDoc: PLAIN_DOC, reviewer }, async ({ service, reviews }) => {
    const result = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: {
        supplierId: SUPPLIER_ID,
        template: { kind: 'standard', id: TEMPLATE_ID }
      }
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 400)
    assert.equal(result.code, 'REVIEW_NOT_NEEDED')
    assert.equal(result.message, 'Esta plantilla no tiene textos dinámicos que revisar.')
    assert.equal(calls, 0)
    assert.equal(reviews.length, 0)
  })
})

test('A missing reviewer is unavailable', async () => {
  let calls = 0
  const reviewer = {
    isReviewerConfigured: () => false,
    review: async () => {
      calls += 1
      return { verdict: 'ok', observations: [], model: 'claude-opus-5' }
    }
  }
  await withService({ templateDoc: DYNAMIC_DOC, reviewer }, async ({ service, reviews, body }) => {
    const result = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 503)
    assert.equal(result.code, 'REVIEW_UNAVAILABLE')
    assert.equal(
      result.message,
      'No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.'
    )
    assert.equal(calls, 0)
    assert.equal(reviews.length, 0)
  })
})

test('Generate without reviewId is rejected', async () => {
  await withService({ templateDoc: DYNAMIC_DOC, reviewer: okReviewer() }, async ({ service, hooks, body }) => {
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 409)
    assert.equal(result.code, 'REVIEW_REQUIRED')
    assert.equal(result.message, 'Revisa la redacción antes de generar: no hay una revisión de los textos actuales.')
    assert.equal(hooks.uploaded, false)
    assert.equal(hooks.inserted, null)
  })
})

test('A review of different values is rejected', async () => {
  await withService({ templateDoc: DYNAMIC_DOC, reviewer: okReviewer() }, async ({ service, hooks, body }) => {
    const reviewed = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    const changed = {
      ...body,
      reviewId: reviewed.data.reviewId,
      missingFieldOverrides: {
        ...body.missingFieldOverrides,
        servicios_entregables: 'un (1) reel en Instagram'
      }
    }
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: changed
    })
    assert.equal(result.status, 409)
    assert.equal(result.code, 'REVIEW_REQUIRED')
    assert.equal(hooks.uploaded, false)
    assert.equal(hooks.inserted, null)
  })
})

test('Dry run does not require a review', async () => {
  await withService({ templateDoc: DYNAMIC_DOC, reviewer: okReviewer() }, async ({ service, hooks, body }) => {
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: { ...body, dryRun: true }
    })
    assert.notEqual(result.code, 'REVIEW_REQUIRED')
    assert.equal(result.ok, true)
    assert.equal(result.data.valid, true)
    assert.equal(hooks.uploaded, false)
  })
})

test('Nine characters are not enough', async () => {
  const reviewer = {
    isReviewerConfigured: () => true,
    review: async () => ({
      verdict: 'observaciones',
      observations: [
        {
          dynamicTextId: 'servicios_entregables',
          clause: '2.3',
          problem: 'Falta la cifra.',
          suggestion: 'cinco (5) reels en TikTok'
        }
      ],
      model: 'claude-opus-5'
    })
  }
  await withService({ templateDoc: DYNAMIC_DOC, reviewer }, async ({ service, hooks, body }) => {
    const reviewed = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    const without = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: { ...body, reviewId: reviewed.data.reviewId }
    })
    assert.equal(without.status, 409)
    assert.equal(without.code, 'REVIEW_HAS_OBSERVATIONS')
    assert.equal(
      without.message,
      'La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.'
    )

    const short = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: {
        ...body,
        reviewId: reviewed.data.reviewId,
        generarIgual: { motivo: '123456789' }
      }
    })
    assert.equal(short.status, 409)
    assert.equal(short.code, 'REVIEW_HAS_OBSERVATIONS')
    assert.equal(hooks.inserted, null)
  })
})

test('A valid motivo is stored with the review', async () => {
  const reviewer = {
    isReviewerConfigured: () => true,
    review: async () => ({
      verdict: 'observaciones',
      observations: [
        {
          dynamicTextId: 'servicios_entregables',
          clause: '2.3',
          problem: 'Falta la cifra.',
          suggestion: 'cinco (5) reels en TikTok'
        }
      ],
      model: 'claude-opus-5'
    })
  }
  await withService({ templateDoc: DYNAMIC_DOC, reviewer }, async ({ service, hooks, body }) => {
    const reviewed = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: {
        ...body,
        reviewId: reviewed.data.reviewId,
        generarIgual: { motivo: '  acepto el texto  ' }
      }
    })
    assert.equal(result.ok, true)
    assert.equal(hooks.inserted.review_id, REVIEW_ID)
    assert.equal(hooks.inserted.review_override_reason, 'acepto el texto')
  })
})

test('An ok review is stored without a motivo', async () => {
  await withService({ templateDoc: DYNAMIC_DOC, reviewer: okReviewer() }, async ({ service, hooks, body }) => {
    const reviewed = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: { ...body, reviewId: reviewed.data.reviewId }
    })
    assert.equal(result.ok, true)
    assert.equal(hooks.inserted.review_id, REVIEW_ID)
    assert.equal(hooks.inserted.review_override_reason, null)
  })
})

test('A template without dynamic text generates as before', async () => {
  await withService({ templateDoc: PLAIN_DOC, reviewer: okReviewer() }, async ({ service, hooks }) => {
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: {
        supplierId: SUPPLIER_ID,
        template: { kind: 'standard', id: TEMPLATE_ID }
      }
    })
    assert.equal(result.ok, true)
    assert.equal(hooks.inserted.review_id, null)
    assert.equal(hooks.inserted.review_override_reason, null)
  })
})

test('Line breaks are collapsed on a reviewed generate', async () => {
  const phrase = 'cinco (5) reels, en TikTok (oficial).'
  await withService({ templateDoc: DYNAMIC_DOC, reviewer: okReviewer() }, async ({ service, hooks }) => {
    const body = baseBody({
      missingFieldOverrides: {
        servicios_entregables: '  cinco (5) reels\n\nen   TikTok  ',
        cuentas_publicacion: phrase,
        mes_ejecucion: 'marzo de 2026',
        fecha_contrato: '2026-03-15',
        precio_numero: PRICE
      }
    })
    const reviewed = await service.reviewDraft({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body
    })
    const result = await service.generateAndPersist({
      userId: USER_ID,
      requestedCompanyId: COMPANY_ID,
      body: { ...body, reviewId: reviewed.data.reviewId }
    })
    assert.equal(result.ok, true)
    assert.equal(hooks.inserted.contract_overrides.servicios_entregables, 'cinco (5) reels en TikTok')
    assert.equal(snapshotText(hooks.inserted.content_snapshot).includes(phrase), true)
  })
})

test('Missing SEGUNDO falls back to numbered clauses', async () => {
  const capture = {}
  await withService(
    { templateDoc: FALLBACK_DOC, reviewer: okReviewer(capture) },
    async ({ service }) => {
      const result = await service.reviewDraft({
        userId: USER_ID,
        requestedCompanyId: COMPANY_ID,
        body: baseBody()
      })
      assert.equal(result.ok, true)
      assert.equal(capture.input.sectionText.includes('2.3'), true)
      assert.equal(capture.input.sectionText.includes('2.5'), true)
      assert.equal(capture.input.sectionText.includes('3.1'), false)
      assert.equal(capture.input.sectionText.includes(FORMATTED_PRICE), false)
    }
  )
})
