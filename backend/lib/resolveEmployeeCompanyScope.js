const { resolveCompanyScopeByUserId } = require('../services/companyScopeService')
const { resolveReadableCompanyId } = require('./resolveReadableCompanyId')

/**
 * Ámbito de compañía para módulos de empleado (USUARIO_EMPRESA_ADMINISTRADOR, CONTADOR).
 * Rechaza ADMINISTRADOR_PLATAFORMA: la gestión de trabajadores no aplica a nivel plataforma.
 * @param {string} userId
 * @param {string | null | undefined} requestedCompanyId
 */
async function resolveEmployeeCompanyScope(userId, requestedCompanyId) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Perfil no asignado.' }
  }
  if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'La gestión de trabajadores no está disponible para el administrador de plataforma.'
    }
  }
  return resolveReadableCompanyId(userId, requestedCompanyId)
}

module.exports = { resolveEmployeeCompanyScope }
