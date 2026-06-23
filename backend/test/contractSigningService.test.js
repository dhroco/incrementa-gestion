const test = require('node:test')
const assert = require('node:assert/strict')
const { PDFDocument } = require('pdf-lib')
const {
  createContractSigningService,
  formatCompanyRut,
  appendSignaturePage
} = require('../services/contractSigningService')

const DRAFT_ID = '11111111-1111-1111-1111-111111111111'
const DOC_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '33333333-3333-3333-3333-333333333333'
const COMPANY_ID = '44444444-4444-4444-4444-444444444444'
const SUPPLIER_ID = '55555555-5555-5555-5555-555555555555'
const TEMPLATE_ID = '66666666-6666-6666-6666-666666666666'

test('formatCompanyRut formats Chilean RUT', () => {
  assert.equal(formatCompanyRut({ rut_body: '76123456', rut_dv: '7' }), '76.123.456-7')
})

test('appendSignaturePage adds page without modifying original page count semantics', async () => {
  const src = await PDFDocument.create()
  src.addPage()
  const original = Buffer.from(await src.save())

  const signed = await appendSignaturePage(original, {
    signerName: 'Ana Usuario',
    company: { business_name: 'Empresa SpA', short_name: 'Empresa', rut_body: '76123456', rut_dv: '7' },
    signedAtFormatted: '1 de junio de 2026, 10:00:00',
    hash: 'abc123'
  })

  const loaded = await PDFDocument.load(signed)
  assert.equal(loaded.getPageCount(), 2)
})

test('listPendingSignature returns mapped items', async () => {
  const rows = [
    {
      id: DRAFT_ID,
      supplier_name: 'Acme SpA',
      supplier_type: 'empresa',
      client_name: 'Cliente',
      template_name: 'Plantilla',
      company_name: 'Empresa SpA',
      company_short_name: 'Empresa',
      company_email: 'empresa@test.cl',
      contract_overrides: { fecha_contrato: '2026-06-01' },
      created_at: '2026-06-01T00:00:00.000Z',
      file_name: 'contrato.pdf',
      gcs_path: 'contratos/path.pdf'
    }
  ]

  const db = Object.assign(
    () => ({
      join() { return this },
      leftJoin() { return this },
      whereNotIn() { return this },
      select() { return this },
      orderBy() { return this },
      then(resolve) {
        return Promise.resolve(resolve(rows))
      }
    }),
    { raw: (sql) => sql }
  )

  const service = createContractSigningService({ db, gcsService: {}, emailService: {} })
  const result = await service.listPendingSignature()

  assert.equal(result.ok, true)
  assert.equal(result.data.items.length, 1)
  assert.equal(result.data.items[0].id, DRAFT_ID)
  assert.equal(result.data.items[0].fecha_contrato, '2026-06-01')
})

test('signContract rejects already signed draft', async () => {
  const db = (table) => {
    if (table === 'draft_document') {
      return {
        where() {
          return {
            first: async () => ({
              id: DRAFT_ID,
              status: 'signed',
              company_id: COMPANY_ID,
              supplier_id: SUPPLIER_ID,
              template_id: TEMPLATE_ID,
              gcs_path: 'path.pdf'
            })
          }
        }
      }
    }
    return {}
  }

  const service = createContractSigningService({
    db,
    gcsService: {},
    emailService: { sendSignedContractEmail: async () => ({ ok: true }) }
  })

  const result = await service.signContract({
    draftDocumentId: DRAFT_ID,
    signerUserProfileId: PROFILE_ID
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'INVALID_STATUS')
})

test('signContract succeeds and logs email failure without rollback', async () => {
  const src = await PDFDocument.create()
  src.addPage()
  const pdfBuffer = Buffer.from(await src.save())

  let emailCalled = false
  let draftUpdated = false
  let documentInserted = false

  const db = (table) => {
    if (table === 'draft_document') {
      return {
        where() {
          return {
            first: async () => ({
              id: DRAFT_ID,
              status: 'draft',
              company_id: COMPANY_ID,
              supplier_id: SUPPLIER_ID,
              template_id: TEMPLATE_ID,
              client_id: null,
              gcs_path: 'contratos/original.pdf',
              file_name: 'contrato.pdf',
              contract_overrides: { fecha_contrato: '2026-06-01' }
            }),
            update: async () => {
              draftUpdated = true
              return 1
            }
          }
        }
      }
    }

    if (table === 'user_profile') {
      return {
        where() {
          return { first: async () => ({ id: PROFILE_ID, full_name: 'Ana Usuario' }) }
        }
      }
    }

    if (table === 'company') {
      return {
        where() {
          return {
            first: async () => ({
              id: COMPANY_ID,
              business_name: 'Empresa SpA',
              short_name: 'Empresa',
              rut_body: '76123456',
              rut_dv: '7',
              email: 'empresa@test.cl'
            })
          }
        }
      }
    }

    if (table === 'template') {
      return {
        where() {
          return { first: async () => ({ id: TEMPLATE_ID, name: 'Plantilla', code: 'PLT' }) }
        }
      }
    }

    if (table === 'supplier as s') {
      return {
        leftJoin() { return this },
        where() { return this },
        select() { return this },
        first: async () => ({ supplier_name: 'Proveedor SpA' })
      }
    }

    return {}
  }

  db.raw = (sql) => sql

  db.transaction = async (fn) => {
    const trx = (table) => {
      if (table === 'document') {
        return {
          insert: async () => {
            documentInserted = true
          }
        }
      }
      if (table === 'draft_document') {
        return {
          where: () => ({
            update: async () => {
              draftUpdated = true
              return 1
            }
          })
        }
      }
      return db(table)
    }
    await fn(trx)
  }

  const gcsService = {
    downloadBuffer: async () => pdfBuffer,
    uploadBuffer: async () => 'contratos-firmados/signed.pdf'
  }

  const emailService = {
    sendSignedContractEmail: async () => {
      emailCalled = true
      throw new Error('SMTP down')
    }
  }

  const service = createContractSigningService({ db, gcsService, emailService })
  const result = await service.signContract({
    draftDocumentId: DRAFT_ID,
    signerUserProfileId: PROFILE_ID
  })

  assert.equal(result.ok, true)
  assert.ok(documentInserted)
  assert.ok(draftUpdated)
  assert.ok(emailCalled)
})
