const HOUR_MS = 60 * 60 * 1000

/** Instante en que vence el enlace según nuestro plazo (desde el envío o la última renovación). */
function expiryInstant(attempt, ttlMs) {
  const approved = new Date(attempt.approved_at).getTime()
  const renewed = attempt.link_renewed_at ? new Date(attempt.link_renewed_at).getTime() : null
  const base = renewed != null && renewed > approved ? renewed : approved
  return new Date(base + ttlMs)
}

/**
 * Decide qué intentos pendientes deben avisarse ahora. Un intento recibe un aviso de «48 h» cuando le
 * quedan entre 24 y 48 h, y de «24 h» cuando le quedan 24 h o menos (sin haber vencido). Si el barrido
 * llega tarde y ya quedan ≤24 h sin haber avisado nada, se manda solo el de 24 h y se marcan ambos.
 * @returns {Array<{ attempt: object, hours: 48|24, expiresAt: Date, mark: string[] }>}
 */
function pickDueAlerts(attempts, now, ttlMs) {
  const due = []
  for (const attempt of attempts) {
    if (attempt.status !== 'pending_signature') continue
    const expiresAt = expiryInstant(attempt, ttlMs)
    const remaining = expiresAt.getTime() - now.getTime()
    if (remaining <= 0 || remaining > 48 * HOUR_MS) continue
    const sent48 = Boolean(attempt.expiry_alert_48_sent_at)
    const sent24 = Boolean(attempt.expiry_alert_24_sent_at)
    if (remaining <= 24 * HOUR_MS) {
      if (!sent24) due.push({ attempt, hours: 24, expiresAt, mark: ['expiry_alert_48_sent_at', 'expiry_alert_24_sent_at'] })
    } else if (!sent48) {
      due.push({ attempt, hours: 48, expiresAt, mark: ['expiry_alert_48_sent_at'] })
    }
  }
  return due
}

module.exports = { expiryInstant, pickDueAlerts, HOUR_MS }
