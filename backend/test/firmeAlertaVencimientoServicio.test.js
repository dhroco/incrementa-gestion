const test = require('node:test')
const assert = require('node:assert/strict')

const { createSigningHarness, attemptRow, IDS } = require('./firmeMemoryDb')
const { createFirmeSigningService } = require('../services/firmeSigningService')

const APPROVED = new Date('2026-11-19T18:00:00.000Z')
const EXPIRES_MS = APPROVED.getTime() + 10 * 24 * 3600 * 1000
const hoursBefore = (h) => new Date(EXPIRES_MS - h * 3600 * 1000)

function setup({ now, attempts, company, emailImpl } = {}) {
  const harness = createSigningHarness({
    rows: {
      draft: { status: 'in_signature', contract_overrides: { client_product_campaign: 'Solbiot' } },
      attempts: attempts || [attemptRow({ approved_at: APPROVED })],
      company
    }
  })
  const sent = []
  const emailService = {
    async sendExpiryAlertEmail(payload) {
      sent.push(payload)
      if (emailImpl) return emailImpl(payload)
      return { ok: true }
    }
  }
  const service = createFirmeSigningService({
    db: harness.db,
    storageService: {},
    emailService,
    firmeClient: harness.client,
    now: () => now,
    environment: 'dev',
    firmeConfigured: true,
    logger: { error() {} }
  })
  return { harness, service, sent }
}

test('con 40 h restantes manda el aviso de 48 h a los correos de la empresa y lo marca', async () => {
  const { harness, service, sent } = setup({ now: hoursBefore(40), company: { email: 'yerko@x.cl, marcela@x.cl' } })
  const out = await service.sendExpiryAlerts()
  assert.deepEqual(out, { avisos: 1, contratos: 1 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'yerko@x.cl, marcela@x.cl')
  assert.equal(sent[0].hours, 48)
  assert.equal(sent[0].items[0].signeeName, 'Ana Pérez')
  assert.equal(sent[0].items[0].templateName, 'Servicios')
  assert.equal(sent[0].items[0].productName, 'Solbiot')
  assert.match(sent[0].items[0].expiresAtText, /2026/)
  const row = harness.db.tables.firme_signing[0]
  assert.ok(row.expiry_alert_48_sent_at)
  assert.equal(row.expiry_alert_24_sent_at, undefined)
})

test('no repite el mismo aviso en el barrido siguiente, y manda el de 24 h después', async () => {
  const first = setup({ now: hoursBefore(40), company: { email: 'a@x.cl' } })
  await first.service.sendExpiryAlerts()
  const again = await first.service.sendExpiryAlerts()
  assert.deepEqual(again, { avisos: 0, contratos: 0 })
  assert.equal(first.sent.length, 1)

  const later = createFirmeSigningService({
    db: first.harness.db,
    storageService: {},
    emailService: { async sendExpiryAlertEmail(p) { first.sent.push(p); return { ok: true } } },
    firmeClient: first.harness.client,
    now: () => hoursBefore(20),
    environment: 'dev',
    firmeConfigured: true,
    logger: { error() {} }
  })
  await later.sendExpiryAlerts()
  assert.equal(first.sent.length, 2)
  assert.equal(first.sent[1].hours, 24)
  assert.ok(first.harness.db.tables.firme_signing[0].expiry_alert_24_sent_at)
})

test('si el correo se omite o falla, no se marca y se reintenta', async () => {
  const skipped = setup({ now: hoursBefore(40), company: { email: 'a@x.cl' }, emailImpl: () => ({ ok: true, skipped: true }) })
  assert.deepEqual(await skipped.service.sendExpiryAlerts(), { avisos: 0, contratos: 0 })
  assert.equal(skipped.harness.db.tables.firme_signing[0].expiry_alert_48_sent_at, undefined)

  const failing = setup({ now: hoursBefore(40), company: { email: 'a@x.cl' }, emailImpl: () => { throw new Error('acs') } })
  assert.deepEqual(await failing.service.sendExpiryAlerts(), { avisos: 0, contratos: 0 })
  assert.equal(failing.harness.db.tables.firme_signing[0].expiry_alert_48_sent_at, undefined)
})

test('empresa sin correo: no envía ni marca', async () => {
  const { harness, service, sent } = setup({ now: hoursBefore(40), company: { email: '' } })
  assert.deepEqual(await service.sendExpiryAlerts(), { avisos: 0, contratos: 0 })
  assert.equal(sent.length, 0)
  assert.equal(harness.db.tables.firme_signing[0].expiry_alert_48_sent_at, undefined)
})

test('varios contratos por vencer de la misma empresa van en un solo correo', async () => {
  const attempts = [
    attemptRow({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', approved_at: APPROVED, document_id: 'd1' }),
    attemptRow({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', approved_at: APPROVED, document_id: 'd2', attempt: 2 })
  ]
  const { service, sent } = setup({ now: hoursBefore(30), attempts, company: { email: 'a@x.cl' } })
  const out = await service.sendExpiryAlerts()
  assert.deepEqual(out, { avisos: 1, contratos: 2 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].items.length, 2)
})

test('lejos del vencimiento no hace nada', async () => {
  const { service, sent } = setup({ now: hoursBefore(100), company: { email: 'a@x.cl' } })
  assert.deepEqual(await service.sendExpiryAlerts(), { avisos: 0, contratos: 0 })
  assert.equal(sent.length, 0)
})

test('el barrido incluye los avisos en su resumen', async () => {
  const { service, sent } = setup({ now: hoursBefore(40), company: { email: 'a@x.cl' } })
  const summary = await service.sweepPending()
  assert.equal(summary.avisos, 1)
  assert.equal(sent.length, 1)
})
