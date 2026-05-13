/**
 * Correos allowlist compartidos por seeds que alinean Auth de desarrollo (010, 012).
 * 012 conserva en `auth.users` a todos los usuarios cuyo correo (normalizado) esté en esta lista.
 * @type {string[]}
 */
const SEED_ALLOWLIST_EMAILS_RAW = [
  'dvd.roco@gmail.com',
  'droco@engineer.com',
  'droco@savenergy.digital',
]

/**
 * @deprecated Usar `SEED_ALLOWLIST_EMAILS_RAW`. Primer correo (compat. con código legado de un solo string).
 * @type {string}
 */
const SEED_ALLOWLIST_EMAIL_RAW = SEED_ALLOWLIST_EMAILS_RAW[0] ?? 'dvd.roco@gmail.com'

module.exports = { SEED_ALLOWLIST_EMAIL_RAW, SEED_ALLOWLIST_EMAILS_RAW }
