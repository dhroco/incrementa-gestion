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
  full_name: 'Juan Pérez',
  rut_display: '11.111.111-1',
  address: 'Calle 1'
}

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

function createGenerateDb({ duplicateRow = null, hooks = {} } = {}) {
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
        content_json: STATIC_DOC
      })
    }
    if (table === 'draft_document') {
      return chainable(duplicateRow, hooks)
    }
    throw new Error(`Unexpected table: ${table}`)
  }
}

function createGenerateDbWithTransaction({ duplicateRow = null, hooks = {} } = {}) {
  const baseDb = createGenerateDb({ duplicateRow, hooks })
  return Object.assign(baseDb, {
    transaction(fn) {
      return fn(baseDb)
    }
  })
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

function mockDraftDocumentDb(row) {
  return function db(table) {
    assert.equal(table, 'draft_document')
    return {
      select() {
        return this
      },
      where() {
        return this
      },
      first: async () => row
    }
  }
}

test('buildDraftGcsPath uses contratos prefix and template code segment', () => {
  const { buildDraftGcsPath } = loadDocumentBuilderService()
  const path = buildDraftGcsPath({
    companyId: 'c1',
    supplierId: 's1',
    templateCode: 'CT-001',
    docId: 'd1',
    fileName: 'doc.pdf'
  })
  assert.match(path, /^contratos\/c1\/s1\/CT-001\/\d{4}\/\d{2}\/d1_doc\.pdf$/)
})

test('generateAndPersist returns 404 when user profile is missing', async () => {
  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: {},
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => null
    })

    const result = await service.generateAndPersist(baseGenerateArgs())

    assert.equal(result.ok, false)
    assert.equal(result.status, 404)
  })
})

test('generateAndPersist returns 409 DUPLICATE_DRAFT when active duplicate exists without overwrite', async () => {
  const duplicate = {
    id: '88888888-8888-8888-8888-888888888888',
    file_name: 'prev.pdf',
    gcs_path: 'contratos/prev.pdf',
    created_at: new Date('2026-05-15T12:00:00.000Z'),
    status: 'draft'
  }
  let uploadCalled = false

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDb({ duplicateRow: duplicate }),
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

    const result = await service.generateAndPersist(baseGenerateArgs())

    assert.equal(result.ok, false)
    assert.equal(result.status, 409)
    assert.equal(result.code, 'DUPLICATE_DRAFT')
    assert.equal(result.data.existing.id, duplicate.id)
    assert.equal(result.data.existing.file_name, duplicate.file_name)
    assert.equal(result.data.existing.status, 'draft')
    assert.equal(uploadCalled, false)
  })
})

test('generateAndPersist overwrites duplicate when overwrite is true', async () => {
  const duplicate = {
    id: '88888888-8888-8888-8888-888888888888',
    file_name: 'prev.pdf',
    gcs_path: 'contratos/prev.pdf',
    created_at: new Date('2026-05-15T12:00:00.000Z'),
    status: 'pending_signature'
  }
  let deletedGcsPath = null
  let deleteCalled = false
  let insertCalled = false

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDbWithTransaction({
        duplicateRow: duplicate,
        hooks: {
          onDelete: () => {
            deleteCalled = true
          },
          onInsert: () => {
            insertCalled = true
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async ({ gcsPath }) => {
          deletedGcsPath = gcsPath
        }
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs({ overwrite: true }))

    assert.equal(result.ok, true)
    assert.equal(deletedGcsPath, duplicate.gcs_path)
    assert.equal(deleteCalled, true)
    assert.equal(insertCalled, true)
    assert.equal(result.data.documents[0].status, 'draft')
  })
})

test('generateAndPersist proceeds when only signed draft exists in same month', async () => {
  let insertCalled = false

  await withReadableCompany(COMPANY_ID, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: createGenerateDbWithTransaction({
        duplicateRow: null,
        hooks: {
          onInsert: () => {
            insertCalled = true
          }
        }
      }),
      supplierService: { getSupplierById: async () => ({ ok: true, data: { supplier: SUPPLIER } }) },
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async () => Buffer.alloc(0),
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.generateAndPersist(baseGenerateArgs())

    assert.equal(result.ok, true)
    assert.equal(insertCalled, true)
  })
})

test('getGeneratedDocumentForDownload reads buffer from GCS', async () => {
  const pdf = Buffer.from('%PDF-1.4')
  let downloadedPath = null
  const gcs_path = 'contratos/co1/s1/tpl/2026/05/doc-1_test.pdf'
  const companyId = COMPANY_ID

  await withReadableCompany(companyId, async ({ createDocumentBuilderService }) => {
    const service = createDocumentBuilderService({
      db: mockDraftDocumentDb({
        id: '55555555-5555-5555-5555-555555555555',
        company_id: companyId,
        file_name: 'test.pdf',
        gcs_path
      }),
      gcsService: {
        uploadBuffer: async () => {},
        downloadBuffer: async ({ gcsPath }) => {
          downloadedPath = gcsPath
          return pdf
        },
        deleteFile: async () => {}
      },
      getUserProfileIdByUserId: async () => PROFILE_ID
    })

    const result = await service.getGeneratedDocumentForDownload({
      userId: USER_ID,
      requestedCompanyId: companyId,
      documentId: '55555555-5555-5555-5555-555555555555'
    })

    assert.equal(result.ok, true)
    assert.equal(result.data.file_name, 'test.pdf')
    assert.deepEqual(result.data.buffer, pdf)
    assert.equal(downloadedPath, gcs_path)
  })
})
