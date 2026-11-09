const test = require('node:test')
const assert = require('node:assert/strict')
const { PDFDocument } = require('pdf-lib')
const { createContractSigningService } = require('../services/contractSigningService')

const DRAFT_ID = '11111111-1111-1111-1111-111111111111'
const PROFILE_ID = '33333333-3333-3333-3333-333333333333'
const COMPANY_ID = '44444444-4444-4444-4444-444444444444'
const SUPPLIER_ID = '55555555-5555-5555-5555-555555555555'
const TEMPLATE_ID = '66666666-6666-6666-6666-666666666666'

async function signWith({ emailService, companyEmail = 'empresa@test.cl' }) {
  const src = await PDFDocument.create()
  src.addPage()
  const pdfBuffer = Buffer.from(await src.save())

  const db = (table) => {
    if (table === 'draft_document') {
      return {
        where: () => ({
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
          update: async () => 1
        })
      }
    }
    if (table === 'user_profile') return { where: () => ({ first: async () => ({ id: PROFILE_ID, full_name: 'Ana Usuario' }) }) }
    if (table === 'company') {
      return {
        where: () => ({
          first: async () => ({
            id: COMPANY_ID,
            business_name: 'Empresa SpA',
            short_name: 'Empresa',
            rut_body: '76123456',
            rut_dv: '7',
            email: companyEmail
          })
        })
      }
    }
    if (table === 'template') return { where: () => ({ first: async () => ({ id: TEMPLATE_ID, name: 'Plantilla', code: 'PLT' }) }) }
    if (table === 'supplier as s') {
      return { leftJoin() { return this }, where() { return this }, select() { return this }, first: async () => ({ supplier_name: 'Proveedor SpA' }) }
    }
    return {}
  }
  db.raw = (sql) => sql
  db.transaction = async (fn) => {
    const trx = (table) => {
      if (table === 'document') return { insert: async () => {} }
      if (table === 'draft_document') return { where: () => ({ update: async () => 1 }) }
      return db(table)
    }
    await fn(trx)
  }

  const storageService = {
    downloadBuffer: async () => pdfBuffer,
    uploadBuffer: async () => 'contratos-firmados/signed.pdf'
  }
  const service = createContractSigningService({ db, storageService, emailService })
  return service.signContract({ draftDocumentId: DRAFT_ID, signerUserProfileId: PROFILE_ID })
}

test('emailSent es true solo cuando el correo se envió de verdad', async () => {
  const calls = []
  const result = await signWith({
    emailService: { sendSignedContractEmail: async (args) => { calls.push(args); return { ok: true } } }
  })
  assert.equal(result.ok, true)
  assert.equal(result.data.emailSent, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].to, 'empresa@test.cl')
})

test('emailSent es false cuando el servicio omite el envío (producción sin Resend)', async () => {
  const result = await signWith({
    emailService: { sendSignedContractEmail: async () => ({ ok: true, skipped: true }) }
  })
  assert.equal(result.ok, true)
  assert.equal(result.data.emailSent, false)
})

test('emailSent es false cuando el envío lanza una excepción, y la firma no se revierte', async () => {
  const result = await signWith({
    emailService: { sendSignedContractEmail: async () => { throw new Error('resend caído') } }
  })
  assert.equal(result.ok, true)
  assert.equal(result.data.emailSent, false)
  assert.ok(result.data.documentId)
})

test('emailSent es false cuando el servicio no devuelve ok ni resultado', async () => {
  for (const returned of [undefined, null, { ok: false }, {}]) {
    const result = await signWith({ emailService: { sendSignedContractEmail: async () => returned } })
    assert.equal(result.ok, true)
    assert.equal(result.data.emailSent, false, JSON.stringify(returned))
  }
})

test('emailSent es false cuando la empresa no tiene correo, y no se intenta enviar', async () => {
  let called = false
  const result = await signWith({
    companyEmail: null,
    emailService: { sendSignedContractEmail: async () => { called = true; return { ok: true } } }
  })
  assert.equal(result.ok, true)
  assert.equal(result.data.emailSent, false)
  assert.equal(result.data.companyEmail, null)
  assert.equal(called, false)
})

test('companyEmail, documentId y fileName no cambian', async () => {
  const result = await signWith({ emailService: { sendSignedContractEmail: async () => ({ ok: true }) } })
  assert.equal(result.data.companyEmail, 'empresa@test.cl')
  assert.match(result.data.documentId, /^[0-9a-f-]{36}$/)
  assert.equal(typeof result.data.fileName, 'string')
  assert.deepEqual(Object.keys(result.data).sort(), ['companyEmail', 'documentId', 'emailSent', 'fileName'])
})
