const test = require('node:test')
const assert = require('node:assert/strict')

const { createSigningHarness, attemptRow, sha256Hex } = require('./firmeMemoryDb')

const NOW = new Date('2026-10-26T15:00:00.000Z')
const STAMPED = Buffer.from('PDF-ESTAMPADO-ORIGINAL')
const SIGNED = Buffer.concat([STAMPED, Buffer.from('\n/ByteRange [0 10 20 30]\n%%EOF')])

function harness(overrides) {
  return createSigningHarness({
    now: NOW,
    originalPdf: Buffer.from('PDF-ORIGINAL'),
    rows: {
      draft: { status: 'in_signature', contract_overrides: overrides },
      attempts: [
        attemptRow({
          stamped_sha256: sha256Hex(STAMPED),
          stamped_byte_length: STAMPED.length,
          approved_at: NOW
        })
      ],
      documents: []
    },
    getDocument: () => ({
      status: 'SIGNED',
      signedOn: '2026-10-26T16:00:00.000Z',
      signees: [{ signedOn: '2026-10-26T16:00:00.000Z' }]
    }),
    downloadSignedPdf: () => SIGNED,
    evidence: { logs: [], signees: [] }
  })
}

test('el adjunto del correo lleva producto, proveedor y mes de la firma', async () => {
  const h = harness({ client_product_campaign: 'Solbiot' })
  await h.service.refresh(h.db.tables.firme_signing[0].id)
  assert.equal(h.emails.length, 1)
  assert.match(h.emails[0].fileName, /^Contrato servicios Influencer Solbiot .+ - octubre 2026 - firmado\.pdf$/)
})

test('el archivo guardado y el registro del documento conservan el nombre con el id', async () => {
  const h = harness({ client_product_campaign: 'Solbiot' })
  const row = h.db.tables.firme_signing[0]
  await h.service.refresh(row.id)
  assert.equal(h.db.tables.document[0].file_name, `${row.document_id}_firmado.pdf`)
})

test('sin producto en el borrador el adjunto igual es legible', async () => {
  const h = harness({})
  await h.service.refresh(h.db.tables.firme_signing[0].id)
  assert.match(h.emails[0].fileName, /^Contrato servicios Influencer .+ - octubre 2026 - firmado\.pdf$/)
  assert.doesNotMatch(h.emails[0].fileName, /undefined|null/)
})
