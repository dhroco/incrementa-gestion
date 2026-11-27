const test = require('node:test')
const assert = require('node:assert/strict')
const { pickDueAlerts, expiryInstant, HOUR_MS } = require('../utils/firmeExpiryAlerts')

const TTL = 10 * 24 * HOUR_MS
const APPROVED = new Date('2026-11-19T18:00:00.000Z')
const EXPIRES = new Date(APPROVED.getTime() + TTL)
const at = (hoursLeft) => new Date(EXPIRES.getTime() - hoursLeft * HOUR_MS)
const attempt = (extra = {}) => ({ id: 'a1', status: 'pending_signature', approved_at: APPROVED, ...extra })

test('el vencimiento sale del envío, o de la renovación si es posterior', () => {
  assert.equal(expiryInstant(attempt(), TTL).toISOString(), EXPIRES.toISOString())
  const renewed = new Date('2026-11-25T12:00:00.000Z')
  assert.equal(
    expiryInstant(attempt({ link_renewed_at: renewed }), TTL).toISOString(),
    new Date(renewed.getTime() + TTL).toISOString()
  )
})

test('con más de 48 h restantes no hay aviso', () => {
  assert.deepEqual(pickDueAlerts([attempt()], at(48.5), TTL), [])
})

test('entre 24 y 48 h restantes avisa «48» una sola vez', () => {
  const [due] = pickDueAlerts([attempt()], at(47), TTL)
  assert.equal(due.hours, 48)
  assert.deepEqual(due.mark, ['expiry_alert_48_sent_at'])
  assert.deepEqual(pickDueAlerts([attempt({ expiry_alert_48_sent_at: new Date() })], at(30), TTL), [])
})

test('con 24 h o menos avisa «24»; si no hubo aviso previo marca ambos', () => {
  const [due] = pickDueAlerts([attempt()], at(20), TTL)
  assert.equal(due.hours, 24)
  assert.deepEqual(due.mark, ['expiry_alert_48_sent_at', 'expiry_alert_24_sent_at'])
  const [second] = pickDueAlerts([attempt({ expiry_alert_48_sent_at: new Date() })], at(20), TTL)
  assert.equal(second.hours, 24)
  assert.deepEqual(pickDueAlerts([attempt({ expiry_alert_24_sent_at: new Date() })], at(5), TTL), [])
})

test('exactamente 48 h y exactamente 24 h cuentan como dentro del plazo', () => {
  assert.equal(pickDueAlerts([attempt()], at(48), TTL)[0].hours, 48)
  assert.equal(pickDueAlerts([attempt()], at(24), TTL)[0].hours, 24)
})

test('ya vencido, firmado o en otro estado no avisa', () => {
  assert.deepEqual(pickDueAlerts([attempt()], at(0), TTL), [])
  assert.deepEqual(pickDueAlerts([attempt()], at(-3), TTL), [])
  assert.deepEqual(pickDueAlerts([attempt({ status: 'signed' }), attempt({ status: 'expired' })], at(20), TTL), [])
})

test('renovar el enlace reinicia el reloj: deja de estar por vencer', () => {
  const renewed = new Date(at(20).getTime() - HOUR_MS)
  assert.deepEqual(pickDueAlerts([attempt({ link_renewed_at: renewed })], at(20), TTL), [])
})
