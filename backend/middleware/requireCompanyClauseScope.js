const { resolveCompanyScopeByUserId } = require('../services/companyScopeService')
const { buildForbiddenBody, buildNoProfileAssignedBody } = require('../sessionResponses')
const { sendError } = require('../http/responses')

function canAccessCompany(scope, companyId) {
  if (!scope || !companyId) return false
  if (scope.mode === 'all') return true
  if (scope.mode === 'single') return scope.companyId === companyId
  if (scope.mode === 'set') return Array.isArray(scope.companyIds) && scope.companyIds.includes(companyId)
  return false
}

function createRequireCompanyClauseScope({ companyScopeResolver = resolveCompanyScopeByUserId } = {}) {
  if (typeof companyScopeResolver !== 'function') throw new Error('companyScopeResolver must be a function')

  return function requireCompanyClauseScope({ getCompanyId }) {
    if (typeof getCompanyId !== 'function') {
      throw new Error('requireCompanyClauseScope requires { getCompanyId: (req) => string|null }')
    }

    return async function middleware(req, res, next) {
      const userId = req?.auth?.userId
      const email = req?.auth?.email ?? null
      if (!userId) {
        return sendError(res, {
          status: 401,
          code: 'AUTH_MISSING_IDENTITY',
          message: 'No autorizado. Falta identidad autenticada.'
        })
      }

      const companyId = getCompanyId(req)
      if (!companyId || typeof companyId !== 'string') {
        return sendError(res, { status: 400, code: 'COMPANY_ID_REQUIRED', message: 'company_id es requerido.' })
      }

      const scope = await companyScopeResolver(userId)
      if (!scope) {
        const body = buildNoProfileAssignedBody(userId, email)
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      // Explicitly deny platform admin for company clauses (business rule).
      if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
        const body = buildForbiddenBody()
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      if (!canAccessCompany(scope, companyId)) {
        const body = buildForbiddenBody()
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      return next()
    }
  }
}

module.exports = { createRequireCompanyClauseScope }

