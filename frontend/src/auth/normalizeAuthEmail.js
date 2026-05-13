/**
 * Alineado con backend `normalizeAuthEmail`: trim + minúsculas para coincidir con el correo en Supabase Auth.
 * @param {unknown} email
 * @returns {string}
 */
export function normalizeAuthEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}
