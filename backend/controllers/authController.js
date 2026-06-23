const { sendError } = require('../http/responses')
const { OidcAuthError, createOidcAuthService } = require('../services/oidcAuthService')

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function handleOidcAuthError(res, err, { invalidCredentialsCode = 'AUTH_INVALID_CREDENTIALS' } = {}) {
  if (err instanceof OidcAuthError) {
    return sendError(res, {
      status: err.status,
      code: err.code === 'AUTH_INVALID_CREDENTIALS' ? invalidCredentialsCode : err.code,
      message: err.message
    })
  }
  return sendError(res, {
    status: 500,
    code: 'UNEXPECTED_ERROR',
    message: 'Ocurrió un error inesperado.'
  })
}

function createAuthController({ oidcAuthService } = {}) {
  const auth = oidcAuthService ?? createOidcAuthService()

  return {
    postLogin: async (req, res) => {
      const { email, password } = req.body ?? {}
      if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
        return sendError(res, {
          status: 400,
          code: 'AUTH_VALIDATION_ERROR',
          message: 'Debe indicar email y contraseña.'
        })
      }

      try {
        const tokens = await auth.loginWithPassword(email.trim(), password)
        return res.status(200).json(tokens)
      } catch (err) {
        return handleOidcAuthError(res, err, { invalidCredentialsCode: 'AUTH_INVALID_CREDENTIALS' })
      }
    },

    postRefresh: async (req, res) => {
      const { refresh_token: refreshToken } = req.body ?? {}
      if (!isNonEmptyString(refreshToken)) {
        return sendError(res, {
          status: 400,
          code: 'AUTH_VALIDATION_ERROR',
          message: 'Debe indicar refresh_token.'
        })
      }

      try {
        const tokens = await auth.refreshTokens(refreshToken.trim())
        return res.status(200).json(tokens)
      } catch (err) {
        return handleOidcAuthError(res, err, {
          invalidCredentialsCode: 'AUTH_INVALID_REFRESH_TOKEN'
        })
      }
    },

    postLogout: async (req, res) => {
      const { refresh_token: refreshToken } = req.body ?? {}
      if (!isNonEmptyString(refreshToken)) {
        return sendError(res, {
          status: 400,
          code: 'AUTH_VALIDATION_ERROR',
          message: 'Debe indicar refresh_token.'
        })
      }

      try {
        await auth.logoutSession(refreshToken.trim())
        return res.status(200).json({ ok: true })
      } catch (err) {
        return handleOidcAuthError(res, err)
      }
    }
  }
}

module.exports = { createAuthController }
