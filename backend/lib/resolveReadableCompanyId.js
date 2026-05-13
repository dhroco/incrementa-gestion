const { resolveCompanyScopeByUserId } = require('../services/companyScopeService')
const { listAssignedCompaniesForAccountant } = require('../services/accountantAssignedCompaniesService')

/**
 * Resuelve el `company_id` efectivo para operaciones por empresa (contador, usuario empresa administrador, plataforma).
 * @param {string} userId
 * @param {string | null | undefined} requestedCompanyId - Header/query; obligatorio para CONTADOR y plataforma.
 * @returns {Promise<{ ok: true, companyId: string } | { ok: false, status: number, code: string, message: string }>}
 */
async function resolveReadableCompanyId(userId, requestedCompanyId) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Perfil no asignado.' }

  if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
    if (!requestedCompanyId || String(requestedCompanyId).trim() === '') {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Debe indicar companyId.' }
    }
    return { ok: true, companyId: String(requestedCompanyId).trim() }
  }

  if (scope.profileCode === 'USUARIO_EMPRESA_ADMINISTRADOR' && scope.mode === 'single' && scope.companyId) {
    if (requestedCompanyId && String(requestedCompanyId).trim() !== scope.companyId) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene acceso a esa empresa.' }
    }
    return { ok: true, companyId: scope.companyId }
  }

  if (scope.profileCode === 'CONTADOR') {
    if (!requestedCompanyId || String(requestedCompanyId).trim() === '') {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Debe seleccionar una empresa.' }
    }
    const cid = String(requestedCompanyId).trim()
    const assigned = await listAssignedCompaniesForAccountant(userId)
    const ok = assigned.some((c) => c.id === cid)
    if (!ok) return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene acceso a esa empresa.' }
    return { ok: true, companyId: cid }
  }

  return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para listar usuarios internos.' }
}

module.exports = { resolveReadableCompanyId }
