const { createRemoteJWKSet, jwtVerify } = require('jose')
const config = require('../config')
const { sendError } = require('../http/responses')

function getBearerToken(req) {
  const header = req.headers.authorization
  if (!header || typeof header !== 'string') return null
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

/**
 * Validates Supabase JWT and sets req.auth = { userId }.
 *
 * Supabase can sign JWTs using signing keys (JWKS). We validate using JWKS when SUPABASE_URL is set.
 * HS256 legacy secret validation is kept as a fallback.
 */
async function requireSupabaseAuth(req, res, next) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      return sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_TOKEN',
        message: 'No autorizado. Falta token de acceso.'
      })
    }

    let payload = null

    // Preferred: JWKS verification (RS256) when Supabase URL is available
    if (config.SUPABASE_URL) {
      const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', config.SUPABASE_URL)
      const JWKS = createRemoteJWKSet(jwksUrl)
      ;({ payload } = await jwtVerify(token, JWKS))
    } else if (config.SUPABASE_JWT_SECRET) {
      // Fallback: legacy HS256
      const encoder = new TextEncoder()
      ;({ payload } = await jwtVerify(token, encoder.encode(config.SUPABASE_JWT_SECRET)))
    } else {
      return sendError(res, {
        status: 500,
        code: 'AUTH_SERVER_MISCONFIG',
        message:
          'Configuración inválida del servidor: falta SUPABASE_URL (JWKS) o SUPABASE_JWT_SECRET para validar tokens.'
      })
    }

    const userId = payload.sub
    if (!userId) {
      return sendError(res, {
        status: 401,
        code: 'AUTH_INVALID_TOKEN',
        message: 'No autorizado. Token inválido.'
      })
    }

    const email = typeof payload.email === 'string' ? payload.email : null
    req.auth = { userId, email }
    return next()
  } catch {
    return sendError(res, {
      status: 401,
      code: 'AUTH_INVALID_OR_EXPIRED_TOKEN',
      message: 'No autorizado. Token inválido o expirado.'
    })
  }
}

module.exports = { requireSupabaseAuth }

