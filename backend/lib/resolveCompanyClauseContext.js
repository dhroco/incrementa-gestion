/**
 * Resolves which company_id applies for company-clause read/write for the current user.
 * - USUARIO_EMPRESA_ADMINISTRADOR: single company from scope (no header).
 * - CONTADOR: must send X-Company-Id and it must be in assigned set.
 */

function readXCompanyId(req) {
  const raw = req.headers['x-company-id']
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

/**
 * @param {import('express').Request} req
 * @param {Awaited<ReturnType<import('../services/companyScopeService').resolveCompanyScopeByUserId>>} scope
 * @returns {{ ok: true, companyId: string } | { ok: false, status: number, code: string, message: string }}
 */
function resolveCompanyIdForCompanyClause(req, scope) {
  if (!scope) {
    return {
      ok: false,
      status: 403,
      code: 'PROFILE_NOT_ASSIGNED',
      message: 'No tiene un perfil interno asignado. Contacte al administrador del sistema.'
    }
  }
  if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Acceso denegado. No tiene permisos para realizar esta acción.'
    }
  }
  if (scope.mode === 'single') {
    const id = scope.companyId ?? null
    if (!id) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'Acceso denegado. No tiene permisos para realizar esta acción.'
      }
    }
    return { ok: true, companyId: id }
  }
  if (scope.mode === 'set') {
    const ids = Array.isArray(scope.companyIds) ? scope.companyIds.filter(Boolean) : []
    if (ids.length === 0) {
      return {
        ok: false,
        status: 403,
        code: 'NO_COMPANY_ASSIGNED',
        message: 'No tiene empresas asignadas.'
      }
    }
    const cid = readXCompanyId(req)
    if (!cid) {
      return {
        ok: false,
        status: 400,
        code: 'COMPANY_CONTEXT_REQUIRED',
        message: 'Debe indicar la empresa de trabajo (encabezado X-Company-Id).'
      }
    }
    if (!ids.includes(cid)) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'Acceso denegado. No tiene permisos para realizar esta acción.'
      }
    }
    return { ok: true, companyId: cid }
  }
  return {
    ok: false,
    status: 403,
    code: 'FORBIDDEN',
    message: 'Acceso denegado. No tiene permisos para realizar esta acción.'
  }
}

module.exports = { readXCompanyId, resolveCompanyIdForCompanyClause }
