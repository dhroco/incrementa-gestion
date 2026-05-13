const { getEffectiveNavigationForUser } = require('../services/authorizationService')
const { buildNoProfileAssignedBody, buildForbiddenBody } = require('../sessionResponses')
const { sendError } = require('../http/responses')

function hasGrantForNavigationCode(rows, navigationCode) {
  return rows.some((r) => r.code === navigationCode)
}

function createRequireNavigationGrant({ effectiveNavigationResolver }) {
  if (typeof effectiveNavigationResolver !== 'function') {
    throw new Error('effectiveNavigationResolver must be a function')
  }

  /**
   * @param {{ navigationCode: string } | { anyOfNavigationCodes: string[] }} resource
   */
  return function requireNavigationGrant(resource) {
    const codes = (() => {
      if (resource && Array.isArray(resource.anyOfNavigationCodes) && resource.anyOfNavigationCodes.length > 0) {
        return resource.anyOfNavigationCodes.filter((c) => typeof c === 'string' && c)
      }
      if (resource && typeof resource.navigationCode === 'string' && resource.navigationCode) {
        return [resource.navigationCode]
      }
      return null
    })()
    if (!codes || codes.length === 0) {
      throw new Error('requireNavigationGrant requires { navigationCode: string } or { anyOfNavigationCodes: string[] }')
    }

    return async function requireNavigationGrantMiddleware(req, res, next) {
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
        return sendError(res, {
          status: 403,
          code: body.code,
          message: body.message,
          meta: { userId: body.userId, email: body.email }
        })
      }

      const { rows } = result
      const allowed = codes.some((code) => hasGrantForNavigationCode(rows, code))
      if (!allowed) {
        const body = buildForbiddenBody()
        return sendError(res, { status: 403, code: body.code, message: body.message })
      }

      return next()
    }
  }
}

const requireNavigationGrant = createRequireNavigationGrant({
  effectiveNavigationResolver: getEffectiveNavigationForUser
})

module.exports = {
  createRequireNavigationGrant,
  requireNavigationGrant
}

