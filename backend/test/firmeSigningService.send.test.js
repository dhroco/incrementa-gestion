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

function send(harness, signee = signeeInput()) {
  return harness.service.sendToFirme({
    draftDocumentId: IDS.draft,
    signee,
    approvedByUserProfileId: IDS.profile
  })
}

test('happy path stores the exact PDF and sends an empty maternal surname as a dot', async () => {
  const harness = createSigningHarness()
  const result = await send(harness)
  assert.equal(result.ok, true)
  assert.equal(result.status, 202)
  assert.deepEqual(harness.ops, ['reserve', 'quota', 'stamp', 'store', 'send'])
  assert.equal(harness.calls.send[0].pdf, harness.stored[0].buffer)
  assert.equal(harness.calls.send[0].pdf, harness.pdf)
  assert.equal(harness.calls.send[0].signees[0].maternalLastName, '.')
  assert.equal(harness.calls.send[0].name, 'Contrato Incrementa — Servicios — Ana Pérez')
  assert.match(harness.stored[0].gcsPath, /^contratos-en-firma\//)
  assert.equal(harness.stored[0].gcsPath.startsWith('contratos-firmados/'), false)
  const row = harness.db.tables.firme_signing[0]
  assert.equal(row.status, 'pending_signature')
  assert.equal(row.stamped_sha256, sha256Hex(harness.pdf))
  assert.equal(row.stamped_byte_length, harness.pdf.length)
  assert.equal(row.signee_maternal_last_name, '.')
  assert.equal(harness.db.tables.draft_document[0].status, 'in_signature')
})

test('invalid RUT does not call Firme or write', async () => {
  const harness = createSigningHarness()
  const result = await send(harness, signeeInput({ documentNumber: '123' }))
  assert.equal(result.status, 422)
  assert.equal(result.code, 'RUT_INVALIDO')
  assert.equal(result.message, 'El RUT del firmante no es válido.')
  assert.equal(harness.ops.length, 0)
  assert.equal(harness.db.tables.firme_signing.length, 0)
  assert.equal(harness.calls.send.length, 0)
})

test('incomplete signee names the correo field', async () => {
  const harness = createSigningHarness()
  const empty = await send(harness, signeeInput({ email: '' }))
  const malformed = await send(harness, signeeInput({ email: 'sin-arroba' }))
  assert.equal(empty.status, 422)
  assert.equal(empty.code, 'FIRMANTE_INCOMPLETO')
  assert.match(empty.message, /correo/)
  assert.equal(malformed.code, 'FIRMANTE_INCOMPLETO')
  assert.match(malformed.message, /correo/)
  assert.equal(harness.calls.send.length, 0)
  assert.equal(harness.db.tables.firme_signing.length, 0)
})

test('no credits fails before creating a document in Firme', async () => {
  const harness = createSigningHarness({ simple: 0 })
  const result = await send(harness)
  assert.equal(result.status, 402)
  assert.equal(result.code, 'FIRME_NO_CREDITS')
  assert.equal(harness.calls.send.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].status, 'send_failed')
  assert.equal(harness.db.tables.firme_signing[0].last_error_code, 'FIRME_NO_CREDITS')
  assert.equal(harness.db.tables.draft_document[0].status, 'draft')
})

test('credits exhausted at complete delete the draft document', async () => {
  const harness = createSigningHarness({
    onSend: async (_input, sendOptions) => {
      await sendOptions.onProgress({
        transactionId: 'tx-c',
        documentCode: 'doc-credits',
        signees: [{ privateCode: 'priv-c' }]
      })
      throw new FirmeClientError('No quedan créditos de firma en Firme para completar el envío.', {
        code: 'FIRME_NO_CREDITS',
        status: 422,
        step: 'complete',
        progress: { transactionId: 'tx-c', documentCode: 'doc-credits', signees: [] }
      })
    }
  })
  const result = await send(harness)
  assert.equal(result.status, 402)
  assert.equal(result.code, 'FIRME_NO_CREDITS')
  assert.deepEqual(harness.calls.deleteDocument, ['doc-credits'])
  assert.equal(harness.db.tables.firme_signing[0].status, 'send_failed')
  assert.equal(harness.db.tables.draft_document[0].status, 'draft')
})

test('a mid-send failure keeps the created ids', async () => {
  const harness = createSigningHarness({
    onSend: async () => {
      throw new FirmeClientError('Error al comunicarse con Firme.', {
        code: 'FIRME_API_ERROR',
        status: 500,
        step: 'signatures',
        progress: { transactionId: 'tx-mid', documentCode: 'doc-mid', signees: [] }
      })
    }
  })
  const result = await send(harness)
  assert.equal(result.ok, false)
  const row = harness.db.tables.firme_signing[0]
  assert.equal(row.firme_transaction_id, 'tx-mid')
  assert.equal(row.firme_document_code, 'doc-mid')
  assert.equal(row.status, 'send_failed')
})

test('ids are stored before complete', async () => {
  let seenDuringProgress = null
  const harness = createSigningHarness({
    onSend: async (_input, sendOptions) => {
      await sendOptions.onProgress({
        transactionId: 'tx-before',
        documentCode: 'doc-before',
        signees: [{ privateCode: 'priv-before' }]
      })
      seenDuringProgress = { ...harness.db.tables.firme_signing[0] }
      throw new FirmeClientError('sin créditos', {
        code: 'FIRME_NO_CREDITS',
        status: 422,
        step: 'complete',
        progress: { transactionId: 'tx-before', documentCode: 'doc-before', signees: [] }
      })
    }
  })
  await send(harness)
  assert.equal(seenDuringProgress.firme_transaction_id, 'tx-before')
  assert.equal(seenDuringProgress.firme_document_code, 'doc-before')
})

test('a second active send is rejected by the partial unique index', async () => {
  const harness = createSigningHarness({
    rows: {
      attempts: [
        attemptRow({
          status: 'sending',
          approved_at: new Date('2026-10-26T14:55:00.000Z'),
          firme_document_code: 'doc-active'
        })
      ]
    }
  })
  const result = await send(harness)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'ENVIO_EN_CURSO')
  assert.equal(result.message, 'Este contrato ya tiene un envío a firma en curso.')
  assert.equal(harness.calls.send.length, 0)
  assert.equal(harness.db.tables.firme_signing.length, 1)
})

test('a hung sending attempt is adopted when Firme already asked for a signature', async () => {
  const harness = createSigningHarness({
    rows: {
      attempts: [
        attemptRow({
          status: 'sending',
          approved_at: new Date('2026-10-26T14:00:00.000Z'),
          firme_document_code: 'doc-hung'
        })
      ]
    },
    getDocument: () => ({ status: 'PENDING_SIGNATURE', signedOn: null, signees: [] })
  })
  const result = await send(harness)
  assert.equal(result.status, 202)
  assert.equal(result.data.status, 'pending_signature')
  assert.equal(harness.calls.send.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
  assert.equal(harness.db.tables.draft_document[0].status, 'in_signature')
  assert.deepEqual(harness.calls.getDocument, ['doc-hung'])
})

test('a hung draft document is deleted', async () => {
  const hungId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const harness = createSigningHarness({
    rows: {
      attempts: [
        attemptRow({
          id: hungId,
          status: 'sending',
          approved_at: new Date('2026-10-26T14:00:00.000Z'),
          firme_document_code: 'doc-draft'
        })
      ]
    },
    getDocument: () => ({ status: 'DRAFT', signedOn: null, signees: [] })
  })
  await send(harness)
  const hung = harness.db.tables.firme_signing.find((row) => row.id === hungId)
  assert.deepEqual(harness.calls.deleteDocument, ['doc-draft'])
  assert.equal(hung.status, 'send_failed')
  assert.equal(hung.last_error_code, 'ENVIO_INTERRUMPIDO')
})

test('a hung attempt without a code does not call Firme', async () => {
  const hungId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const harness = createSigningHarness({
    rows: {
      attempts: [
        attemptRow({
          id: hungId,
          status: 'sending',
          approved_at: new Date('2026-10-26T14:00:00.000Z'),
          firme_document_code: null
        })
      ]
    }
  })
  await send(harness)
  const hung = harness.db.tables.firme_signing.find((row) => row.id === hungId)
  assert.equal(hung.status, 'send_failed')
  assert.equal(harness.calls.getDocument.length, 0)
  assert.equal(harness.calls.deleteDocument.length, 0)
})

test('missing rubric sends nothing', async () => {
  const harness = createSigningHarness({
    buildStampedPdf: async () => {
      const err = new Error('La empresa no tiene registrada la rúbrica del representante; no se puede enviar a firma.')
      err.code = 'RUBRICA_NO_DISPONIBLE'
      err.status = 422
      throw err
    }
  })
  const result = await send(harness)
  assert.equal(result.status, 422)
  assert.equal(result.code, 'RUBRICA_NO_DISPONIBLE')
  assert.equal(harness.calls.send.length, 0)
})

test('a rejected attempt can be sent again as attempt 2', async () => {
  const harness = createSigningHarness({
    rows: {
      draft: { status: 'in_signature' },
      attempts: [attemptRow({ status: 'rejected', attempt: 1, firme_document_code: 'doc-old' })]
    }
  })
  const result = await send(harness)
  assert.equal(result.ok, true)
  const created = harness.db.tables.firme_signing.find((row) => row.status === 'pending_signature')
  assert.equal(created.attempt, 2)
})

test('a non-Chilean supplier does not use Firme', async () => {
  const harness = createSigningHarness({
    rows: { documentType: 'RFC' }
  })
  const mode = await harness.service.getSigningMode(IDS.draft)
  assert.equal(mode, 'internal')
  const result = await send(harness)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'NO_APLICA_FIRME')
  assert.equal(harness.db.tables.firme_signing.length, 0)
})

test('production without Firme is blocked and other environments stay internal', async () => {
  const blocked = createSigningHarness({
    environment: 'prod',
    firmeConfigured: false,
    rows: { documentType: 'RFC' }
  })
  assert.equal(await blocked.service.getSigningMode(IDS.draft), 'blocked')
  const internal = createSigningHarness({ environment: 'dev', firmeConfigured: false })
  assert.equal(await internal.service.getSigningMode(IDS.draft), 'internal')
  const firme = createSigningHarness({ firmeConfigured: true })
  assert.equal(await firme.service.getSigningMode(IDS.draft), 'firme')
})
