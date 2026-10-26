const test = require('node:test')
const assert = require('node:assert/strict')

const { createSigningHarness, attemptRow, IDS, sha256Hex } = require('./firmeMemoryDb')

const NOW = new Date('2026-10-26T15:00:00.000Z')
const STAMPED = Buffer.from('PDF-ESTAMPADO-ORIGINAL')
const ORIGINAL = Buffer.from('PDF-ORIGINAL')

function signedWithRange(prefix = STAMPED) {
  return Buffer.concat([prefix, Buffer.from('\n/ByteRange [0 10 20 30]\n%%EOF')])
}

function harnessFor(options = {}) {
  const stamped = options.stamped || STAMPED
  const signed = options.signed || signedWithRange(stamped)
  return createSigningHarness({
    now: NOW,
    originalPdf: ORIGINAL,
    blobs: options.blobs,
    emailError: options.emailError,
    emailResult: options.emailResult,
    rows: {
      draft: { status: 'in_signature' },
      attempts: [
        attemptRow({
          stamped_sha256: sha256Hex(stamped),
          stamped_byte_length: stamped.length,
          approved_at: NOW
        })
      ],
      documents: options.documents || []
    },
    getDocument: () => ({
      status: 'SIGNED',
      signedOn: '2026-10-26T16:00:00.000Z',
      signees: [{ signedOn: '2026-10-26T16:00:00.000Z' }]
    }),
    downloadSignedPdf: () => signed,
    evidence: {
      logs: [{ action: 'sent' }],
      signees: [{ events: [{ type: 'delivered' }], certificates: [{ pdf: Buffer.from('%PDF-cert') }] }]
    }
  })
}

test('a valid signed PDF is stored once with evidence and hashes', async () => {
  const harness = harnessFor()
  const signed = signedWithRange()
  const result = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(result.data.status, 'signed')
  const row = harness.db.tables.firme_signing[0]
  assert.match(row.signed_gcs_path, /^contratos-firmados\//)
  assert.match(row.signed_gcs_path, /bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb_firmado\.pdf$/)
  assert.match(row.evidence_gcs_path, /_evidencia\.json$/)
  assert.equal(harness.db.tables.document.length, 1)
  const document = harness.db.tables.document[0]
  assert.equal(document.id, row.document_id)
  assert.equal(document.file_name, `${row.document_id}_firmado.pdf`)
  assert.equal(document.source, 'generated')
  assert.equal(document.signed_by, 'Ana Pérez')
  assert.equal(document.draft_sha256, sha256Hex(ORIGINAL))
  assert.equal(document.signed_sha256, sha256Hex(signed))
  assert.equal(row.signed_sha256, sha256Hex(signed))
  assert.equal(harness.db.tables.draft_document[0].status, 'signed')
  assert.equal(harness.emails.length, 1)
  assert.equal(harness.emails[0].pdfBuffer.equals(signed), true)
  const evidence = JSON.parse(harness.blobs.get(row.evidence_gcs_path).toString())
  assert.equal(evidence.firmeDocumentCode, 'doc-1')
  assert.ok(Array.isArray(evidence.logs))
  assert.ok(Array.isArray(evidence.events))
  assert.equal(harness.stored.some((item) => String(item.gcsPath).includes('http')), false)
})

test('a different prefix is a hash mismatch and stores the received PDF', async () => {
  const harness = harnessFor({ signed: signedWithRange(Buffer.from('OTRO-PREFIJO-DISTINTO')) })
  const result = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(result.data.status, 'hash_mismatch')
  assert.equal(harness.db.tables.firme_signing[0].last_error_code, 'HASH_NO_COINCIDE')
  assert.equal(harness.db.tables.document.length, 0)
  assert.equal(harness.db.tables.draft_document[0].status, 'in_signature')
  const received = [...harness.blobs.keys()].find((path) => path.endsWith('_recibido.pdf'))
  assert.match(received, /^contratos-en-firma\//)
})

test('missing ByteRange is a hash mismatch and creates no document', async () => {
  const harness = harnessFor({ signed: Buffer.concat([STAMPED, Buffer.from('\nmas bytes sin rango')]) })
  const result = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(result.data.status, 'hash_mismatch')
  assert.equal(harness.db.tables.document.length, 0)
})

test('the same blob hash does not duplicate the document', async () => {
  const harness = harnessFor()
  const id = harness.db.tables.firme_signing[0].id
  await harness.service.refresh(id)
  harness.db.tables.firme_signing[0].status = 'pending_signature'
  harness.db.tables.draft_document[0].status = 'in_signature'
  const again = await harness.service.refresh(id)
  assert.equal(again.data.status, 'signed')
  assert.equal(harness.db.tables.document.length, 1)
})

test('a different blob hash conflicts', async () => {
  const signed = signedWithRange()
  const harness = harnessFor()
  const row = harness.db.tables.firme_signing[0]
  const year = '2026'
  const month = new Intl.DateTimeFormat('en', { timeZone: 'America/Santiago', month: '2-digit' }).format(NOW)
  const path = `contratos-firmados/${IDS.company}/${IDS.supplier}/SERV/${year}/${month}/${row.document_id}_firmado.pdf`
  harness.blobs.set(path, Buffer.from('bytes-distintos'))
  const result = await harness.service.refresh(row.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'STORAGE_CONFLICT')
  assert.equal(harness.db.tables.document.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
})

test('a failed registration resumes on the next refresh', async () => {
  const harness = harnessFor()
  harness.db.failDocumentInsert = true
  const first = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(first.ok, false)
  assert.equal(harness.db.tables.document.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
  const blobCount = harness.blobs.size
  const second = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(second.data.status, 'signed')
  assert.equal(harness.db.tables.document.length, 1)
  assert.equal(harness.db.tables.draft_document[0].status, 'signed')
  assert.equal(harness.blobs.size, blobCount)
})

test('email failure does not roll back the signature', async () => {
  const thrown = harnessFor({ emailError: new Error('resend down') })
  const thrownResult = await thrown.service.refresh(thrown.db.tables.firme_signing[0].id)
  assert.equal(thrownResult.data.status, 'signed')
  assert.equal(thrown.db.tables.firme_signing[0].status, 'signed')
  assert.equal(thrown.emails[0].pdfBuffer.equals(signedWithRange()), true)

  const skipped = harnessFor({ emailResult: { ok: true, skipped: true } })
  const skippedResult = await skipped.service.refresh(skipped.db.tables.firme_signing[0].id)
  assert.equal(skippedResult.data.status, 'signed')
  assert.equal(skipped.db.tables.firme_signing[0].status, 'signed')
})
