const { getEffectiveNavigationForUser } = require('../services/authorizationService')
const { buildForbiddenBody, buildNoProfileAssignedBody } = require('../sessionResponses')
const { sendError } = require('../http/responses')

function hasCode(rows, code) {
  return Array.isArray(rows) && rows.some((r) => r.code === code)
}

function createRequireClauseUniversalGrant({ effectiveNavigationResolver }) {
  return function requireClauseUniversalGrant({ navigationCode }) {
    if (!navigationCode || typeof navigationCode !== 'string') {
      throw new Error('requireClauseUniversalGrant requires { navigationCode: string }')
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

      const result = await effectiveNavigationResolver(userId)
      if (!result) {
        const body = buildNoProfileAssignedBody(userId, email)
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      if (!hasCode(result.rows, navigationCode)) {
        const body = buildForbiddenBody()
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      return next()
    }
  }
}

const requireClauseUniversalGrant = createRequireClauseUniversalGrant({
  effectiveNavigationResolver: getEffectiveNavigationForUser
})

module.exports = { createRequireClauseUniversalGrant, requireClauseUniversalGrant }

