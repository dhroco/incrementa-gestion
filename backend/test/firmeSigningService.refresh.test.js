const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createSigningHarness,
  attemptRow,
  IDS,
  sha256Hex,
  FirmeClientError
} = require('./firmeMemoryDb')

const NOW = new Date('2026-10-26T15:00:00.000Z')
const STAMPED = Buffer.from('PDF-ESTAMPADO-ORIGINAL')

function signedPdf(extra = '\n/ByteRange [0 10 20 30]') {
  return Buffer.concat([STAMPED, Buffer.from(extra)])
}

function pendingHarness(options = {}) {
  const stamped = options.stamped || STAMPED
  return createSigningHarness({
    now: options.now || NOW,
    originalPdf: Buffer.from('PDF-ORIGINAL'),
    rows: {
      draft: { status: 'in_signature' },
      attempts: [
        attemptRow({
          status: 'pending_signature',
          approved_at: options.approved_at || NOW,
          link_renewed_at: options.link_renewed_at || null,
          stamped_sha256: sha256Hex(stamped),
          stamped_byte_length: stamped.length,
          ...(options.attempt || {})
        })
      ]
    },
    getDocument: options.getDocument,
    downloadSignedPdf: options.downloadSignedPdf || (() => signedPdf(options.tail)),
    emailError: options.emailError,
    emailResult: options.emailResult,
    evidence: options.evidence
  })
}

test('rejected, cancelled and expired map from Firme and the draft stays in signature', async () => {
  const rejected = pendingHarness({
    getDocument: () => ({
      status: 'REJECTED',
      signees: [{ rejectionDetail: 'No corresponde el monto' }]
    })
  })
  const rejectedResult = await rejected.service.refresh(rejected.db.tables.firme_signing[0].id)
  assert.equal(rejectedResult.data.status, 'rejected')
  assert.equal(rejected.db.tables.firme_signing[0].rejection_reason, 'No corresponde el monto')
  assert.equal(rejected.db.tables.draft_document[0].status, 'in_signature')

  const cancelled = pendingHarness({
    getDocument: () => ({ status: 'CANCELLED', signees: [] })
  })
  const cancelledResult = await cancelled.service.refresh(cancelled.db.tables.firme_signing[0].id)
  assert.equal(cancelledResult.data.status, 'cancelled')
  assert.equal(cancelled.db.tables.draft_document[0].status, 'in_signature')

  const expired = pendingHarness({
    approved_at: new Date('2026-10-01T15:00:00.000Z'),
    getDocument: () => ({ status: 'PENDING_SIGNATURE', signees: [{}] })
  })
  const expiredResult = await expired.service.refresh(expired.db.tables.firme_signing[0].id)
  assert.equal(expiredResult.data.status, 'expired')
  assert.equal(expired.db.tables.draft_document[0].status, 'in_signature')
})

test('renewal date replaces the approval date', async () => {
  const harness = pendingHarness({
    approved_at: new Date('2026-10-01T15:00:00.000Z'),
    link_renewed_at: new Date('2026-10-24T15:00:00.000Z'),
    getDocument: () => ({ status: 'PENDING_SIGNATURE', signees: [{}] })
  })
  const result = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(result.data.status, 'pending_signature')
})

test('a network error keeps the status and stores the error code', async () => {
  const harness = pendingHarness({
    getDocument: () => {
      throw new FirmeClientError('No se pudo conectar con Firme.', { code: 'FIRME_NETWORK_ERROR' })
    }
  })
  const result = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(result.data.status, 'pending_signature')
  assert.equal(harness.db.tables.firme_signing[0].status, 'pending_signature')
  assert.equal(harness.db.tables.firme_signing[0].last_error_code, 'FIRME_NETWORK_ERROR')
})

test('a locked attempt is skipped and does not call Firme', async () => {
  const harness = pendingHarness({
    getDocument: () => ({ status: 'SIGNED', signedOn: NOW.toISOString(), signees: [] })
  })
  harness.db.skipLocks = true
  const before = harness.db.tables.firme_signing[0].status
  const result = await harness.service.refresh(harness.db.tables.firme_signing[0].id)
  assert.equal(result.skipped, true)
  assert.equal(result.data.status, before)
  assert.equal(harness.calls.getDocument.length, 0)
})

test('pending and expired attempts resend without a new credit', async () => {
  const pending = pendingHarness()
  const pendingResult = await pending.service.resendLink(pending.db.tables.firme_signing[0].id)
  assert.equal(pendingResult.ok, true)
  assert.deepEqual(pending.calls.resend, [{ code: 'doc-1', privateCode: 'priv-1' }])
  assert.equal(pending.db.tables.firme_signing[0].status, 'pending_signature')

  const expired = pendingHarness({ attempt: { status: 'expired' } })
  const expiredResult = await expired.service.resendLink(expired.db.tables.firme_signing[0].id)
  assert.equal(expiredResult.ok, true)
  assert.equal(expired.db.tables.firme_signing[0].status, 'pending_signature')
  assert.ok(expired.db.tables.firme_signing[0].link_renewed_at)
})

test('another status cannot resend', async () => {
  const harness = pendingHarness({ attempt: { status: 'rejected' } })
  const result = await harness.service.resendLink(harness.db.tables.firme_signing[0].id)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'INVALID_STATUS')
  assert.equal(harness.calls.resend.length, 0)
})

test('Firme 422 does not change the attempt', async () => {
  const harness = createSigningHarness({
    now: NOW,
    rows: {
      draft: { status: 'in_signature' },
      attempts: [attemptRow({ status: 'expired' })]
    },
    resendError: new FirmeClientError('no se puede', { status: 422, code: 'FIRME_API_ERROR' })
  })
  const result = await harness.service.resendLink(harness.db.tables.firme_signing[0].id)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'ENLACE_NO_RENOVABLE')
  assert.match(result.message, /Reenviar a firma/)
  assert.equal(harness.db.tables.firme_signing[0].status, 'expired')
})

test('sweep covers only stale pending attempts', async () => {
  const attempts = []
  for (let index = 0; index < 22; index += 1) {
    attempts.push(
      attemptRow({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        document_id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        attempt: index + 1,
        status: 'pending_signature',
        firme_document_code: `doc-${index}`,
        last_checked_at: index < 20 ? null : new Date('2026-10-26T14:55:00.000Z'),
        draft_document_id: IDS.draft
      })
    )
  }
  attempts.push(
    attemptRow({
      id: '20000000-0000-4000-8000-000000000099',
      document_id: '30000000-0000-4000-8000-000000000099',
      attempt: 99,
      status: 'pending_signature',
      firme_document_code: 'doc-fresh',
      last_checked_at: new Date('2026-10-26T14:55:00.000Z')
    })
  )
  const harness = createSigningHarness({
    now: NOW,
    rows: { draft: { status: 'in_signature' }, attempts },
    getDocument: () => ({ status: 'PENDING_SIGNATURE', signees: [{}] })
  })
  harness.db.lockedIds = new Set(['00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000001'])
  const summary = await harness.service.sweepPending()
  assert.equal(summary.revisados + summary.saltados + summary.errores <= 20, true)
  assert.equal(summary.saltados, 2)
  assert.equal(harness.calls.getDocument.includes('doc-fresh'), false)
  assert.equal(harness.calls.getDocument.length, 18)
})
