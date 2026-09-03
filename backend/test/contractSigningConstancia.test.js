const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { spawnSync } = require('node:child_process')

const { PNG } = require('pngjs')
const { PDFDocument } = require('pdf-lib')

const { createContractSigningService } = require('../services/contractSigningService')
const { buildPdfBytesFromTipTapWithReactPdf } = require('../services/documentBuilderTipTapReactPdf')

function para(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function makeTransparentPngBuffer({ size = 8 } = {}) {
  const png = new PNG({ width: size, height: size })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0 // r
    png.data[i + 1] = 0 // g
    png.data[i + 2] = 0 // b
    png.data[i + 3] = 0 // a (transparent)
  }
  return PNG.sync.write(png)
}

function extractPdfTextAndPagesInChild(buf) {
  const b64 = Buffer.isBuffer(buf) ? buf.toString('base64') : Buffer.from(buf).toString('base64')
  const code = `
    (async () => {
      const pdfParse = require('pdf-parse');
      const buf = Buffer.from(process.env.PDF_B64, 'base64');
      const r = await pdfParse(buf);
      process.stdout.write(JSON.stringify({ text: r.text || '', numPages: r.numpages }));
    })().catch((e) => {
      process.stderr.write(String(e && e.message ? e.message : e));
      process.exit(1);
    });
  `

  const r = spawnSync(process.execPath, ['-e', code], {
    env: { ...process.env, PDF_B64: b64 },
    encoding: 'utf8'
  })

  if (r.status !== 0) {
    throw new Error(`pdfjs last page extraction failed: ${String(r.stderr || '').slice(0, 200)}`)
  }

  return JSON.parse(r.stdout)
}

function normalizeForIncludes(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function countImageXObjects(pdfBuffer) {
  // En PDF, las imágenes suelen aparecer como XObject con '/Subtype /Image'.
  const s = pdfBuffer.toString('latin1')
  return (s.match(/\/Subtype\s*\/Image/g) || []).length
}

test('5.3 (I2): snapshot null -> firma ok y constancia honesta (sin imagen registrada)', async () => {
  const draftId = '11111111-1111-1111-1111-111111111111'
  const profileId = '22222222-2222-2222-2222-222222222222'
  const companyId = '33333333-3333-3333-3333-333333333333'
  const supplierId = '44444444-4444-4444-4444-444444444444'
  const templateId = '55555555-5555-5555-5555-555555555555'

  const originalPdf = await PDFDocument.create().then((d) => {
    d.addPage()
    return d.save()
  })
  const originalBuffer = Buffer.from(originalPdf)

  const signedDraftSha = crypto.createHash('sha256').update(originalBuffer).digest('hex')

  let lastInsert = null
  let uploadedSignedBuffer = null

  const db = (table) => {
    if (table === 'draft_document') {
      return {
        where() {
          return {
            first: async () => ({
              id: draftId,
              status: 'draft',
              content_snapshot: null,
              company_id: companyId,
              supplier_id: supplierId,
              template_id: templateId,
              client_id: null,
              gcs_path: 'draft/original.pdf',
              file_name: 'contrato.pdf',
              contract_overrides: null
            })
          }
        }
      }
    }

    if (table === 'user_profile') {
      return { where() { return { first: async () => ({ id: profileId, full_name: 'Ana Usuario' }) } } }
    }

    if (table === 'company') {
      return {
        where() {
          return {
            first: async () => ({
              id: companyId,
              business_name: 'Empresa SpA',
              short_name: 'Empresa',
              rut_body: '76123456',
              rut_dv: '7',
              email: null
            })
          }
        }
      }
    }

    if (table === 'template') {
      return { where() { return { first: async () => ({ id: templateId, name: 'Plantilla', code: 'PLT' }) } } }
    }

    if (table === 'supplier as s') {
      return {
        leftJoin() { return this },
        where() { return this },
        select() { return this },
        first: async () => ({ supplier_name: 'Proveedor SpA' })
      }
    }

    if (table === 'legal_rep_signature') {
      // Ojo: si el snapshot es null, NO debiese consultarse esta tabla.
      return {
        select() {
          return {
            where: async () => [{ rep_index: 1, gcs_path: 'firmas-representantes/1/1.png' }]
          }
        }
      }
    }

    return {}
  }

  db.raw = (sql) => sql

  db.transaction = async (fn) => {
    const trx = (t) => {
      if (t === 'document') {
        return {
          insert: async (payload) => {
            lastInsert = payload
          }
        }
      }
      if (t === 'draft_document') {
        return { where: () => ({ update: async () => 1 }) }
      }
      return db(t)
    }
    await fn(trx)
  }

  const gcsService = {
    downloadBuffer: async ({ gcsPath }) => {
      if (gcsPath === 'draft/original.pdf') return originalBuffer
      // Si esto se ejecuta, el test falla porque snapshot es null (no debería descargar firma).
      if (gcsPath.includes('firmas-representantes')) throw new Error('PNG caída: no debiese llamarse')
      throw new Error(`Unexpected gcsPath: ${gcsPath}`)
    },
    uploadBuffer: async ({ buffer }) => {
      uploadedSignedBuffer = buffer
      return 'contratos-firmados/signed.pdf'
    }
  }

  const service = createContractSigningService({
    db,
    gcsService,
    emailService: {}
  })

  const res = await service.signContract({ draftDocumentId: draftId, signerUserProfileId: profileId })
  assert.equal(res.ok, true)
  assert.equal(lastInsert.draft_sha256, signedDraftSha)
  assert.equal(lastInsert.signed_sha256, signedDraftSha)

  const { text } = extractPdfTextAndPagesInChild(uploadedSignedBuffer)
  const normalized = normalizeForIncludes(text)
  assert.ok(!normalized.includes('imagen registrada'))
  assert.ok(normalized.includes('re-renderizado') || normalized.includes('renderizado'))
})

test('5.4 (I3): con stamp, constancia no menciona partes/proveedor y sí incluye "imagen registrada"', async () => {
  const draftId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const profileId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const companyId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  const supplierId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  const templateId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

  const transparentSig = makeTransparentPngBuffer({ size: 12 })

  // Snapshot con 2 bloques: company (mitad 1) y supplier (debe quedar sin imagen).
  const snapshot = {
    type: 'doc',
    content: [
      para('CUERPO_LINEA_1'),
      {
        type: 'signatureBlock',
        attrs: { party: 'company', repIndex: 1 },
        content: [para('________________________'), para('Ana Usuario'), para('p.p. EMPRESA SpA')]
      },
      {
        type: 'signatureBlock',
        attrs: { party: 'supplier' },
        content: [para('________________________'), para('Proveedor SpA')]
      }
    ]
  }

  const bodyOriginalBuffer = await buildPdfBytesFromTipTapWithReactPdf(snapshot, { signatureImages: {} })
  const bodyStampedBuffer = await buildPdfBytesFromTipTapWithReactPdf(snapshot, { signatureImages: { 'company:1': transparentSig } })

  const originalBuffer = Buffer.from(bodyOriginalBuffer)
  const draftSha = crypto.createHash('sha256').update(originalBuffer).digest('hex')

  let lastInsert = null
  let uploadedSignedBuffer = null

  const db = (table) => {
    if (table === 'draft_document') {
      return {
        where() {
          return {
            first: async () => ({
              id: draftId,
              status: 'draft',
              content_snapshot: snapshot,
              company_id: companyId,
              supplier_id: supplierId,
              template_id: templateId,
              client_id: null,
              gcs_path: 'draft/original.pdf',
              file_name: 'contrato.pdf',
              contract_overrides: null
            })
          }
        }
      }
    }
    if (table === 'user_profile') {
      return { where() { return { first: async () => ({ id: profileId, full_name: 'Ana Usuario' }) } } }
    }
    if (table === 'company') {
      return {
        where() {
          return {
            first: async () => ({
              id: companyId,
              business_name: 'Empresa SpA',
              short_name: 'Empresa',
              rut_body: '76123456',
              rut_dv: '7',
              email: null
            })
          }
        }
      }
    }
    if (table === 'template') {
      return { where() { return { first: async () => ({ id: templateId, name: 'Plantilla', code: 'PLT' }) } } }
    }
    if (table === 'supplier as s') {
      return {
        leftJoin() { return this },
        where() { return this },
        select() { return this },
        first: async () => ({ supplier_name: 'Proveedor SpA' })
      }
    }
    if (table === 'legal_rep_signature') {
      return {
        select() {
          return {
            where: async () => [{ rep_index: 1, gcs_path: 'firmas-representantes/company/1/abc.png' }]
          }
        }
      }
    }
    return {}
  }

  db.raw = (sql) => sql

  db.transaction = async (fn) => {
    const trx = (t) => {
      if (t === 'document') {
        return { insert: async (payload) => { lastInsert = payload } }
      }
      if (t === 'draft_document') {
        return { where: () => ({ update: async () => 1 }) }
      }
      return db(t)
    }
    await fn(trx)
  }

  const gcsService = {
    downloadBuffer: async ({ gcsPath }) => {
      if (gcsPath === 'draft/original.pdf') return originalBuffer
      if (gcsPath.includes('firmas-representantes')) return transparentSig
      throw new Error(`Unexpected gcsPath: ${gcsPath}`)
    },
    uploadBuffer: async ({ buffer }) => {
      uploadedSignedBuffer = buffer
      return 'contratos-firmados/signed.pdf'
    }
  }

  const service = createContractSigningService({ db, gcsService, emailService: {} })

  const res = await service.signContract({ draftDocumentId: draftId, signerUserProfileId: profileId })
  assert.equal(res.ok, true)

  assert.equal(lastInsert.draft_sha256, draftSha)
  assert.notEqual(lastInsert.signed_sha256, lastInsert.draft_sha256)

  const { text } = extractPdfTextAndPagesInChild(uploadedSignedBuffer)
  const normalized = normalizeForIncludes(text)
  assert.ok(!normalized.includes('firmado por las partes'))
  assert.ok(!normalized.includes('el proveedor firmo'))
  assert.ok(normalized.includes('imagen registrada'))
})

test('5.5: con snapshot e imagen, solo company recibe imagen; supplier no (y no se re-subde el borrador)', async () => {
  const draftId = '12121212-1212-1212-1212-121212121212'
  const profileId = '34343434-3434-3434-3434-343434343434'
  const companyId = '56565656-5656-5656-5656-565656565656'
  const supplierId = '78787878-7878-7878-7878-787878787878'
  const templateId = '90909090-9090-9090-9090-909090909090'

  const transparentSig = makeTransparentPngBuffer({ size: 12 })

  const snapshot = {
    type: 'doc',
    content: [
      {
        type: 'signatureBlock',
        attrs: { party: 'company', repIndex: 1 },
        content: [para('________________________'), para('Ana Usuario'), para('p.p. EMPRESA SpA')]
      },
      {
        type: 'signatureBlock',
        attrs: { party: 'supplier' },
        content: [para('________________________'), para('Proveedor SpA')]
      }
    ]
  }

  const bodyOriginalBuffer = Buffer.from(await buildPdfBytesFromTipTapWithReactPdf(snapshot, { signatureImages: {} }))
  const signatureGcsPath = 'firmas-representantes/company/1/abc.png'

  let uploadedPaths = []
  let uploadedSignedBuffer = null

  const db = (table) => {
    if (table === 'draft_document') {
      return {
        where() {
          return {
            first: async () => ({
              id: draftId,
              status: 'draft',
              content_snapshot: snapshot,
              company_id: companyId,
              supplier_id: supplierId,
              template_id: templateId,
              client_id: null,
              gcs_path: 'draft/original.pdf',
              file_name: 'contrato.pdf',
              contract_overrides: null
            })
          }
        }
      }
    }
    if (table === 'user_profile') {
      return { where() { return { first: async () => ({ id: profileId, full_name: 'Ana Usuario' }) } } }
    }
    if (table === 'company') {
      return {
        where() {
          return {
            first: async () => ({
              id: companyId,
              business_name: 'Empresa SpA',
              short_name: 'Empresa',
              rut_body: '76123456',
              rut_dv: '7',
              email: null
            })
          }
        }
      }
    }
    if (table === 'template') {
      return { where() { return { first: async () => ({ id: templateId, name: 'Plantilla', code: 'PLT' }) } } }
    }
    if (table === 'supplier as s') {
      return {
        leftJoin() { return this },
        where() { return this },
        select() { return this },
        first: async () => ({ supplier_name: 'Proveedor SpA' })
      }
    }
    if (table === 'legal_rep_signature') {
      return {
        select() {
          return {
            where: async () => [{ rep_index: 1, gcs_path: signatureGcsPath }]
          }
        }
      }
    }
    return {}
  }

  db.raw = (sql) => sql
  db.transaction = async (fn) => {
    const trx = (t) => {
      if (t === 'document') return { insert: async () => {} }
      if (t === 'draft_document') return { where: () => ({ update: async () => 1 }) }
      return db(t)
    }
    await fn(trx)
  }

  const gcsService = {
    downloadBuffer: async ({ gcsPath }) => {
      if (gcsPath === 'draft/original.pdf') return bodyOriginalBuffer
      if (gcsPath === signatureGcsPath) return transparentSig
      throw new Error(`Unexpected gcsPath: ${gcsPath}`)
    },
    uploadBuffer: async ({ buffer, gcsPath }) => {
      uploadedPaths.push(gcsPath)
      uploadedSignedBuffer = buffer
      return 'contratos-firmados/signed.pdf'
    }
  }

  const service = createContractSigningService({ db, gcsService, emailService: {} })
  const res = await service.signContract({ draftDocumentId: draftId, signerUserProfileId: profileId })
  assert.equal(res.ok, true)

  // No se re-subió el borrador como firmado (solo el nuevo firmado).
  assert.ok(!uploadedPaths.includes('draft/original.pdf'))

  // Solo una imagen debería existir (company:1). Si supplier tuviera imagen,
  // aparecería otra vez como '/Subtype /Image'.
  const expectedNoSupplierBody = await buildPdfBytesFromTipTapWithReactPdf(snapshot, {
    signatureImages: { 'company:1': transparentSig }
  })
  const expectedNoSupplierCount = countImageXObjects(Buffer.from(expectedNoSupplierBody))

  const imageCount = countImageXObjects(uploadedSignedBuffer)
  assert.equal(imageCount, expectedNoSupplierCount)
})

