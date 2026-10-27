const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createSigningHarness,
  attemptRow,
  signeeInput,
  IDS,
  sha256Hex,
  FirmeClientError
} = require('./firmeMemoryDb')

const NOW = new Date('2026-10-26T15:00:00.000Z')
const SIGNED_ON = '2026-10-26T16:00:00.000Z'
const STAMPED = Buffer.from('PDF-ESTAMPADO-ORIGINAL')
const ORIGINAL = Buffer.from('PDF-ORIGINAL')

function signedWithRange(prefix = STAMPED) {
  return Buffer.concat([prefix, Buffer.from('\n/ByteRange [0 10 20 30]\n%%EOF')])
}

function finalizeHarness(clock) {
  return createSigningHarness({
    now: clock,
    originalPdf: ORIGINAL,
    rows: {
      draft: { status: 'in_signature' },
      attempts: [
        attemptRow({
          stamped_sha256: sha256Hex(STAMPED),
          stamped_byte_length: STAMPED.length,
          approved_at: NOW
        })
      ]
    },
    getDocument: () => ({
      status: 'SIGNED',
      signedOn: SIGNED_ON,
      signees: [{ signedOn: SIGNED_ON }]
    }),
    downloadSignedPdf: () => signedWithRange(),
    evidence: {
      logs: [{ action: 'sent' }],
      signees: [{ events: [{ type: 'delivered' }], certificates: [{ pdf: Buffer.from('%PDF-cert') }] }]
    }
  })
}

function send(harness) {
  return harness.service.sendToFirme({
    draftDocumentId: IDS.draft,
    signee: signeeInput(),
    approvedByUserProfileId: IDS.profile
  })
}

function failSend(progress, error) {
  return async (_input, sendOptions) => {
    if (sendOptions?.onProgress) await sendOptions.onProgress(progress)
    throw error
  }
}

test('a retry after the evidence upload survives a different clock', async () => {
  const clock = new Date('2026-10-26T15:00:00.000Z')
  const harness = finalizeHarness(clock)
  harness.db.failDocumentInsert = true
  const id = harness.db.tables.firme_signing[0].id
  const first = await harness.service.refresh(id)
  assert.equal(first.ok, false)
  assert.equal(harness.db.tables.document.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
  const evidencePath = [...harness.blobs.keys()].find((path) => path.endsWith('_evidencia.json'))
  const firstBytes = Buffer.from(harness.blobs.get(evidencePath))
  const evidence = JSON.parse(firstBytes.toString())
  assert.equal(evidence.verifiedAt, SIGNED_ON)
  assert.equal(evidence.signedOn, SIGNED_ON)
  clock.setTime(Date.parse('2026-10-27T18:30:00.000Z'))
  const second = await harness.service.refresh(id)
  assert.equal(second.data.status, 'signed')
  assert.equal(harness.db.tables.document.length, 1)
  assert.equal(harness.db.tables.draft_document[0].status, 'signed')
  assert.equal(Buffer.from(harness.blobs.get(evidencePath)).equals(firstBytes), true)
})

test('a failed send adopts a document that is already pending signature', async () => {
  const harness = createSigningHarness({
    getDocument: () => ({ status: 'PENDING_SIGNATURE', signedOn: null, signees: [] }),
    onSend: failSend(
      { transactionId: 'tx-amb', documentCode: 'doc-amb', signees: [{ privateCode: 'priv-amb' }] },
      new FirmeClientError('No se pudo conectar con Firme.', {
        code: 'FIRME_NETWORK_ERROR',
        step: 'complete',
        progress: { transactionId: 'tx-amb', documentCode: 'doc-amb', signees: [] }
      })
    )
  })
  const result = await send(harness)
  assert.equal(result.status, 202)
  assert.equal(result.data.status, 'pending_signature')
  assert.equal(harness.calls.deleteDocument.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
  assert.equal(harness.db.tables.draft_document[0].status, 'in_signature')
})

test('a failed send stays in sending when the document cannot be queried', async () => {
  const harness = createSigningHarness({
    getDocument: () => {
      throw new FirmeClientError('No se pudo conectar con Firme.', { code: 'FIRME_NETWORK_ERROR' })
    },
    onSend: failSend(
      { transactionId: 'tx-q', documentCode: 'doc-q', signees: [] },
      new FirmeClientError('Error al comunicarse con Firme.', {
        code: 'FIRME_API_ERROR',
        status: 500,
        step: 'complete',
        progress: { transactionId: 'tx-q', documentCode: 'doc-q', signees: [] }
      })
    )
  })
  const result = await send(harness)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'ENVIO_INTERRUMPIDO')
  assert.equal(harness.db.tables.firme_signing[0].status, 'sending')
  assert.equal(harness.calls.deleteDocument.length, 0)
  assert.equal(harness.db.tables.draft_document[0].status, 'draft')
})

test('a failed send deletes only a document that is still a draft', async () => {
  const harness = createSigningHarness({
    getDocument: () => ({ status: 'DRAFT', signedOn: null, signees: [] }),
    onSend: failSend(
      { transactionId: 'tx-draft', documentCode: 'doc-draft-fail', signees: [] },
      new FirmeClientError('No quedan créditos de firma en Firme para completar el envío.', {
        code: 'FIRME_NO_CREDITS',
        status: 422,
        step: 'complete',
        progress: { transactionId: 'tx-draft', documentCode: 'doc-draft-fail', signees: [] }
      })
    )
  })
  const result = await send(harness)
  assert.equal(result.status, 402)
  assert.equal(result.code, 'FIRME_NO_CREDITS')
  assert.deepEqual(harness.calls.deleteDocument, ['doc-draft-fail'])
  assert.equal(harness.db.tables.firme_signing[0].status, 'send_failed')
  assert.equal(harness.db.tables.draft_document[0].status, 'draft')
})

test('markFailed does not overwrite an attempt that is no longer sending', async () => {
  const harness = createSigningHarness({
    rows: {
      attempts: [
        attemptRow({
          status: 'sending',
          approved_at: new Date('2026-10-26T14:00:00.000Z'),
          firme_document_code: 'doc-race'
        })
      ]
    },
    getDocument: () => {
      harness.db.tables.firme_signing[0].status = 'pending_signature'
      return { status: 'DRAFT', signedOn: null, signees: [] }
    }
  })
  const result = await send(harness)
  assert.equal(result.ok, false)
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
  assert.notEqual(harness.db.tables.firme_signing[0].last_error_code, 'ENVIO_INTERRUMPIDO')
})

test('a long non-JSON webhook body is not stored', async () => {
  const harness = createSigningHarness()
  const raw = 'x'.repeat(2000)
  const result = await harness.service.handleWebhook({ rawBody: raw, headers: {} })
  assert.deepEqual(result, { ok: true })
  assert.equal(harness.db.tables.firme_webhook_event.length, 0)
})
