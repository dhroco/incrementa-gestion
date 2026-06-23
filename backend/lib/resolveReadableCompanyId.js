const { resolveCompanyScopeByUserId } = require('../services/companyScopeService')

const PLATFORM_COMPANY_SCOPE_PROFILES = new Set(['ADMINISTRADOR_PLATAFORMA', 'MCP_SERVICE'])

/**
 * Resuelve el `company_id` efectivo para operaciones por empresa (actores de sistema con alcance total).
 * @param {string} userId
 * @param {string | null | undefined} requestedCompanyId
 * @returns {Promise<{ ok: true, companyId: string } | { ok: false, status: number, code: string, message: string }>}
 */
async function resolveReadableCompanyId(userId, requestedCompanyId) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Perfil no asignado.' }

  if (PLATFORM_COMPANY_SCOPE_PROFILES.has(scope.profileCode)) {
    if (!requestedCompanyId || String(requestedCompanyId).trim() === '') {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Debe indicar companyId.' }
    }
    return { ok: true, companyId: String(requestedCompanyId).trim() }
  }

  return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para esta operación.' }
}

module.exports = { resolveReadableCompanyId }
