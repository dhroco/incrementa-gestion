const test = require('node:test')
const assert = require('node:assert/strict')
const { getDynamicTextDefinition } = require('../services/dynamicTextCatalog')
const { getVariableMeta, resolveFieldDefinition } = require('../services/documentBuilderService')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const SUPPLIER_ID = '33333333-3333-3333-3333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '66666666-6666-6666-6666-666666666666'

const ENTREGABLES_INSTRUCCION =
  'Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.'
const ENTREGABLES_EJEMPLOS = [
  'un (1) reel en Instagram',
  'cinco (5) reels en TikTok y cuatro (4) reels en Facebook',
  'dos (2) stories y un (1) reel en Instagram'
]
const CUENTAS_INSTRUCCION =
  'Escribe la cuenta del influencer en cada red social nombrada en los entregables.'
const CUENTAS_EJEMPLOS = [
  'su cuenta de Instagram @danarebolledo',
  'su cuenta de TikTok @danarebolledo y su cuenta de Facebook Dana Rebolledo'
]
const FRASE_ENTREGABLES = 'cinco (5) reels en TikTok y cuatro (4) reels en Facebook'
const LENGTH_MESSAGE =
  'El texto de «Entregables (cláusula 2.3)» no puede superar los 500 caracteres.'

const SUPPLIER = {
  supplier_type: 'persona_natural',
  country_code: 'CL',
  full_name: 'Juan Pérez',
  document_display: '11.111.111-1',
  address: 'Calle 1'
}

function clauseParagraph(variableId) {
  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'En concreto, los Servicios comprenden la generación y publicación de '
      },
      { type: 'variable', attrs: { variableId } },
      { type: 'text', text: ' en el perfil oficial ' },
      { type: 'variable', attrs: { variableId: 'client_product_campaign' } },
      { type: 'text', text: '.' }
    ]
  }
}

const DOC_ENTREGABLES = {
  type: 'doc',
  content: [clauseParagraph('servicios_entregables')]
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
        content_json: contentJson,
        country_code: 'CL'
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

async function generateWithDoc(templateDoc, bodyExtra, hooks = {}) {
  let uploadCalled = false
  let insertedPayload = null
  let result
  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({
        templateDoc,
        hooks: {
          ...hooks,
          onInsert: (payload) => {
            insertedPayload = payload
            if (hooks.onInsert) hooks.onInsert(payload)
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
    result = await service.generateAndPersist(baseGenerateArgs(bodyExtra))
  })
  return { result, uploadCalled, insertedPayload }
}

test('Known id returns the catalog entry', () => {
  const entregables = getDynamicTextDefinition('servicios_entregables')
  assert.equal(entregables.label, 'Entregables (cláusula 2.3)')
  assert.equal(entregables.instruccion, ENTREGABLES_INSTRUCCION)
  assert.deepEqual(entregables.ejemplos, ENTREGABLES_EJEMPLOS)

  const cuentas = getDynamicTextDefinition('cuentas_publicacion')
  assert.equal(cuentas.label, 'Cuentas de publicación (cláusula 2.5)')
  assert.equal(cuentas.instruccion, CUENTAS_INSTRUCCION)
  assert.deepEqual(cuentas.ejemplos, CUENTAS_EJEMPLOS)
})

test('Unknown id is undefined', () => {
  assert.equal(getDynamicTextDefinition('evento_servicio'), undefined)
})

test('Dynamic text ids resolve before they appear in a template', () => {
  assert.deepEqual(getVariableMeta('servicios_entregables'), {
    label: 'Entregables (cláusula 2.3)',
    type: 'dynamic_text',
    source: 'contract'
  })
  assert.deepEqual(getVariableMeta('cuentas_publicacion'), {
    label: 'Cuentas de publicación (cláusula 2.5)',
    type: 'dynamic_text',
    source: 'contract'
  })
})

test('Context is null without a template document', () => {
  const field = resolveFieldDefinition('cuentas_publicacion', {})
  assert.equal(field.instruccion, CUENTAS_INSTRUCCION)
  assert.deepEqual(field.ejemplos, CUENTAS_EJEMPLOS)
  assert.equal(field.contexto, null)
})

test('A second paragraph is ignored', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Primero ' },
          { type: 'variable', attrs: { variableId: 'cuentas_publicacion' } },
          { type: 'text', text: ' fin.' }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Segundo ' },
          { type: 'variable', attrs: { variableId: 'cuentas_publicacion' } },
          { type: 'text', text: ' otro.' }
        ]
      }
    ]
  }
  const field = resolveFieldDefinition('cuentas_publicacion', { templateDoc: doc })
  assert.equal(field.contexto, 'Primero ⟨…⟩ fin.')
})

test('Dry run exposes the first paragraph with the hole marked', async () => {
  const { result, uploadCalled } = await generateWithDoc(DOC_ENTREGABLES, { dryRun: true })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'MISSING_PLACEHOLDERS')
  const field = result.data.missingFields.find((item) => item.key === 'servicios_entregables')
  assert.equal(field.type, 'dynamic_text')
  assert.equal(field.instruccion, ENTREGABLES_INSTRUCCION)
  assert.deepEqual(field.ejemplos, ENTREGABLES_EJEMPLOS)
  assert.equal(
    field.contexto,
    'En concreto, los Servicios comprenden la generación y publicación de ⟨…⟩ en el perfil oficial {{client_product_campaign}}.'
  )
  assert.equal(uploadCalled, false)
})

test('Missing fields include metadata', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Firma el {{fecha_contrato}}. ' },
          { type: 'variable', attrs: { variableId: 'servicios_entregables' } }
        ]
      }
    ]
  }
  const { result } = await generateWithDoc(doc, { dryRun: true })
  assert.equal(result.code, 'MISSING_PLACEHOLDERS')
  const date = result.data.missingFields.find((item) => item.key === 'fecha_contrato')
  const dynamic = result.data.missingFields.find((item) => item.key === 'servicios_entregables')
  assert.ok(date)
  assert.equal(date.type, 'date')
  assert.equal('instruccion' in date, false)
  assert.equal('ejemplos' in date, false)
  assert.equal('contexto' in date, false)
  assert.equal(dynamic.type, 'dynamic_text')
  assert.ok(dynamic.instruccion)
})

// Desde revision-redaccion, generar con textos dinámicos exige una revisión.
// La normalización al guardar se prueba con revisión en documentBuilderService.review.test.js.
const REVIEW_REQUIRED_MESSAGE =
  'Revisa la redacción antes de generar: no hay una revisión de los textos actuales.'

test('Generating with a dynamic text and no review is rejected (collapsed spaces)', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'variable', attrs: { variableId: 'servicios_entregables' } }]
      }
    ]
  }
  const { result, uploadCalled, insertedPayload } = await generateWithDoc(doc, {
    missingFieldOverrides: {
      servicios_entregables: '  cinco (5) reels\n\nen   TikTok  '
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'REVIEW_REQUIRED')
  assert.equal(result.message, REVIEW_REQUIRED_MESSAGE)
  assert.equal(uploadCalled, false)
  assert.equal(insertedPayload, null)
})

test('501 characters are rejected', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'variable', attrs: { variableId: 'servicios_entregables' } }]
      }
    ]
  }
  for (const dryRun of [true, false]) {
    const { result, uploadCalled, insertedPayload } = await generateWithDoc(doc, {
      dryRun,
      missingFieldOverrides: { servicios_entregables: 'a'.repeat(501) }
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 400)
    assert.equal(result.code, 'VALIDATION_ERROR')
    assert.equal(result.message, LENGTH_MESSAGE)
    assert.equal(uploadCalled, false)
    assert.equal(insertedPayload, null)
  }
})

test('500 characters pass', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'variable', attrs: { variableId: 'servicios_entregables' } }]
      }
    ]
  }
  const { result } = await generateWithDoc(doc, {
    dryRun: true,
    missingFieldOverrides: { servicios_entregables: 'a'.repeat(500) }
  })
  assert.notEqual(result.code, 'VALIDATION_ERROR')
  assert.equal(result.ok, true)
  assert.equal(result.data.valid, true)
})

test('Generating with a dynamic text and no review is rejected (punctuation)', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'variable', attrs: { variableId: 'servicios_entregables' } }]
      }
    ]
  }
  const { result, uploadCalled, insertedPayload } = await generateWithDoc(doc, {
    missingFieldOverrides: { servicios_entregables: FRASE_ENTREGABLES }
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'REVIEW_REQUIRED')
  assert.equal(result.message, REVIEW_REQUIRED_MESSAGE)
  assert.equal(uploadCalled, false)
  assert.equal(insertedPayload, null)
})
