/**
 * Normaliza correo para comparación estable con `auth.users` (trim + minúsculas).
 * @param {unknown} email
 * @returns {string}
 */
function normalizeAuthEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

module.exports = { normalizeAuthEmail }
