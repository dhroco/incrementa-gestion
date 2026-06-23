const config = require('../config')

class OidcAuthError extends Error {
  constructor({ code, status, message }) {
    super(message ?? code)
    this.name = 'OidcAuthError'
    this.code = code
    this.status = status
  }
}

function buildOidcUrls(issuerUrl) {
  const base = issuerUrl.replace(/\/$/, '')
  return {
    tokenUrl: `${base}/protocol/openid-connect/token`,
    logoutUrl: `${base}/protocol/openid-connect/logout`
  }
}

function mapTokenResponse(body) {
  if (!body || typeof body !== 'object') {
    throw new OidcAuthError({
      code: 'IDP_UNAVAILABLE',
      status: 503,
      message: 'Respuesta inválida del proveedor de identidad.'
    })
  }
  const { access_token, refresh_token, expires_in, token_type } = body
  if (!access_token || !token_type) {
    throw new OidcAuthError({
      code: 'IDP_UNAVAILABLE',
      status: 503,
      message: 'Respuesta incompleta del proveedor de identidad.'
    })
  }
  return {
    access_token,
    refresh_token: refresh_token ?? null,
    expires_in,
    token_type
  }
}

function assertOidcConfigured(issuerUrl, clientSecret) {
  if (!issuerUrl) {
    throw new OidcAuthError({
      code: 'AUTH_SERVER_MISCONFIG',
      status: 500,
      message: 'Configuración inválida del servidor: falta OIDC_ISSUER_URL.'
    })
  }
  if (!clientSecret) {
    throw new OidcAuthError({
      code: 'AUTH_SERVER_MISCONFIG',
      status: 500,
      message: 'Configuración inválida del servidor: falta OIDC_CLIENT_SECRET.'
    })
  }
}

function createOidcAuthService({
  issuerUrl = config.OIDC_ISSUER_URL,
  clientId = config.OIDC_CLIENT_ID,
  clientSecret = config.OIDC_CLIENT_SECRET,
  fetchImpl = fetch
} = {}) {
  const urls = issuerUrl ? buildOidcUrls(issuerUrl) : null

  async function postForm(url, params) {
    assertOidcConfigured(issuerUrl, clientSecret)
    const body = new URLSearchParams(params)
    let response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })
    } catch {
      throw new OidcAuthError({
        code: 'AUTH_IDP_UNAVAILABLE',
        status: 503,
        message: 'El proveedor de identidad no está disponible. Intente más tarde.'
      })
    }

    let json = null
    const text = await response.text()
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
    }

    return { response, json }
  }

  async function loginWithPassword(email, password) {
    const { response, json } = await postForm(urls.tokenUrl, {
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: email,
      password
    })

    if (response.status === 401) {
      throw new OidcAuthError({
        code: 'AUTH_INVALID_CREDENTIALS',
        status: 401,
        message: 'Credenciales inválidas.'
      })
    }

    if (!response.ok) {
      throw new OidcAuthError({
        code: 'AUTH_IDP_UNAVAILABLE',
        status: 503,
        message: 'El proveedor de identidad no está disponible. Intente más tarde.'
      })
    }

    return mapTokenResponse(json)
  }

  async function refreshTokens(refreshToken) {
    const { response, json } = await postForm(urls.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    })

    if (response.status === 401 || response.status === 400) {
      throw new OidcAuthError({
        code: 'AUTH_INVALID_REFRESH_TOKEN',
        status: 401,
        message: 'Token de actualización inválido o expirado.'
      })
    }

    if (!response.ok) {
      throw new OidcAuthError({
        code: 'AUTH_IDP_UNAVAILABLE',
        status: 503,
        message: 'El proveedor de identidad no está disponible. Intente más tarde.'
      })
    }

    return mapTokenResponse(json)
  }

  async function logoutSession(refreshToken) {
    const { response } = await postForm(urls.logoutUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    })

    if (response.status >= 500) {
      throw new OidcAuthError({
        code: 'AUTH_IDP_UNAVAILABLE',
        status: 503,
        message: 'El proveedor de identidad no está disponible. Intente más tarde.'
      })
    }

    return { ok: true }
  }

  return {
    loginWithPassword,
    refreshTokens,
    logoutSession
  }
}

module.exports = {
  OidcAuthError,
  buildOidcUrls,
  createOidcAuthService
}
