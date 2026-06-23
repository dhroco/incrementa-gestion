const { createRemoteJWKSet, jwtVerify } = require('jose')
const config = require('../config')
const { sendError } = require('../http/responses')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')

let remoteJwks = null
let jwksInitPromise = null

function getBearerToken(req) {
  const header = req.headers.authorization
  if (!header || typeof header !== 'string') return null
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

function getDiscoveryUrl(issuerUrl) {
  const base = issuerUrl.replace(/\/$/, '')
  return `${base}/.well-known/openid-configuration`
}

async function initRemoteJwks() {
  const discoveryUrl = getDiscoveryUrl(config.OIDC_ISSUER_URL)
  const response = await fetch(discoveryUrl)
  if (!response.ok) {
    throw new Error(`OIDC discovery failed: ${response.status}`)
  }
  const document = await response.json()
  if (!document.jwks_uri || typeof document.jwks_uri !== 'string') {
    throw new Error('OIDC discovery document missing jwks_uri')
  }
  return createRemoteJWKSet(new URL(document.jwks_uri))
}

function audienceMatches(payload, expected) {
  const aud = payload.aud
  if (aud) {
    if (Array.isArray(aud) && aud.includes(expected)) return true
    if (typeof aud === 'string' && aud === expected) return true
  }
  return payload.azp === expected
}

async function getRemoteJwks() {
  if (remoteJwks) return remoteJwks
  if (!jwksInitPromise) {
    jwksInitPromise = initRemoteJwks()
      .then((jwks) => {
        remoteJwks = jwks
        return jwks
      })
      .catch((err) => {
        jwksInitPromise = null
        throw err
      })
  }
  return jwksInitPromise
}

/**
 * Validates OIDC JWT (Keycloak, Entra ID, etc.) and sets req.auth = { userId, email }.
 * JWKS is resolved lazily from the issuer discovery document on the first authenticated request.
 */
async function requireOidcAuth(req, res, next) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      return sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_TOKEN',
        message: 'No autorizado. Falta token de acceso.'
      })
    }

    if (!config.OIDC_ISSUER_URL) {
      return sendError(res, {
        status: 500,
        code: 'AUTH_SERVER_MISCONFIG',
        message:
          'Configuración inválida del servidor: falta OIDC_ISSUER_URL para validar tokens.'
      })
    }

    const JWKS = await getRemoteJwks()
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.OIDC_ISSUER_URL
    })

    const expectedAudience = config.OIDC_AUDIENCE
    if (expectedAudience && !audienceMatches(payload, expectedAudience)) {
      throw new Error('JWT audience mismatch')
    }

    const userId = payload.sub
    if (!userId) {
      return sendError(res, {
        status: 401,
        code: 'AUTH_INVALID_TOKEN',
        message: 'No autorizado. Token inválido.'
      })
    }

    const email = extractAuthEmailFromPayload(payload)
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

function extractAuthEmailFromPayload(payload) {
  const raw =
    typeof payload.email === 'string'
      ? payload.email
      : typeof payload.preferred_username === 'string'
        ? payload.preferred_username
        : ''
  const normalized = normalizeAuthEmail(raw)
  return normalized || null
}

module.exports = { requireOidcAuth, extractAuthEmailFromPayload }
