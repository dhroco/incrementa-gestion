const { getEffectiveNavigationForUser } = require('../services/authorizationService')
const { resolveCompanyScopeByUserId } = require('../services/companyScopeService')
const { buildNoProfileAssignedBody, buildForbiddenBody } = require('../sessionResponses')
const { sendError } = require('../http/responses')

function hasCode(rows, code) {
  return Array.isArray(rows) && rows.some((r) => r.code === code)
}

function createRequireClauseByIdGrant({
  effectiveNavigationResolver,
  clauseService,
  companyScopeResolver = resolveCompanyScopeByUserId
}) {
  if (typeof effectiveNavigationResolver !== 'function') throw new Error('effectiveNavigationResolver must be a function')
  if (!clauseService || typeof clauseService.getClauseDetail !== 'function') {
    throw new Error('clauseService with getClauseDetail is required')
  }
  if (typeof companyScopeResolver !== 'function') throw new Error('companyScopeResolver must be a function')

  return function requireClauseByIdGrant({ universalNavigationCode, companyNavigationCode }) {
    if (!universalNavigationCode || typeof universalNavigationCode !== 'string') {
      throw new Error('requireClauseByIdGrant requires { universalNavigationCode: string }')
    }
    if (!companyNavigationCode || typeof companyNavigationCode !== 'string') {
      throw new Error('requireClauseByIdGrant requires { companyNavigationCode: string }')
    }

    return async function middleware(req, res, next) {
      const userId = req?.auth?.userId
      const email = req?.auth?.email ?? null
      const id = req?.params?.id

      if (!userId) {
        return sendError(res, {
          status: 401,
          code: 'AUTH_MISSING_IDENTITY',
          message: 'No autorizado. Falta identidad autenticada.'
        })
      }
      if (!id) {
        return sendError(res, { status: 400, code: 'CLAUSE_INVALID_ID', message: 'ID inválido.' })
      }

      const clause = await clauseService.getClauseDetail(id)
      if (!clause) {
        return sendError(res, { status: 404, code: 'CLAUSE_NOT_FOUND', message: 'Cláusula no encontrada.' })
      }

      const requiredCode =
        clause.type === 'universal' ? universalNavigationCode : clause.type === 'company' ? companyNavigationCode : null
      if (!requiredCode) return next()

      const result = await effectiveNavigationResolver(userId)
      if (!result) {
        const body = buildNoProfileAssignedBody(userId, email)
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      if (!hasCode(result.rows, requiredCode)) {
        const body = buildForbiddenBody()
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      // Scope enforcement for company clauses:
      if (clause.type === 'company') {
        const scope = await companyScopeResolver(userId)
        if (!scope) {
          const body = buildNoProfileAssignedBody(userId, email)
          return sendError(res, { status: 403, code: body.code, message: body.message })
        }
        if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
          const body = buildForbiddenBody()
          return sendError(res, { status: 403, code: body.code, message: body.message })
        }
        const companyId = clause.company_id ?? null
        const ok =
          scope.mode === 'single'
            ? scope.companyId === companyId
            : scope.mode === 'set'
              ? Array.isArray(scope.companyIds) && scope.companyIds.includes(companyId)
              : false
        if (!ok) {
          const body = buildForbiddenBody()
          return sendError(res, { status: 403, code: body.code, message: body.message })
        }
      }

      return next()
    }
  }
}

module.exports = { createRequireClauseByIdGrant }

