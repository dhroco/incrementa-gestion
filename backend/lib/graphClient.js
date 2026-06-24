const config = require('../config')

const { normalizeAuthEmail } = require('./normalizeAuthEmail')

/**
 * Cliente Microsoft Graph (app-only): lookup de usuarios por email en solo lectura.
 */

const TOKEN_REFRESH_MARGIN_MS = 10_000

/** @type {{ accessToken: string | null, expiresAt: number }} */
let tokenCache = { accessToken: null, expiresAt: 0 }

/** @type {GraphClient | null} */
let clientSingleton = null

class GraphClientError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string }} [opts]
   */
  constructor(message, opts = {}) {
    super(message)
    this.name = 'GraphClientError'
    this.status = opts.status
    this.code = opts.code
  }
}

function isGraphConfigured() {
  return Boolean(config.GRAPH_TENANT_ID && config.GRAPH_CLIENT_ID && config.GRAPH_CLIENT_SECRET)
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeODataString(value) {
  return String(value).replace(/'/g, "''")
}

function mapGraphError(status, bodyText) {
  let detail = ''
  try {
    const parsed = JSON.parse(bodyText)
    detail = parsed?.error?.message || parsed?.error?.code || ''
  } catch {
    detail = bodyText?.slice(0, 200) || ''
  }
  const suffix = detail ? ` (${detail})` : ''
  return new GraphClientError(`Error al consultar Microsoft Graph${suffix}.`, {
    status,
    code: 'GRAPH_API_ERROR'
  })
}

async function fetchClientCredentialsToken() {
  const url = `https://login.microsoftonline.com/${config.GRAPH_TENANT_ID}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.GRAPH_CLIENT_ID,
    client_secret: config.GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default'
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const text = await res.text()
  if (!res.ok) {
    throw new GraphClientError(
      'No se pudo autenticar contra Microsoft Graph (revise GRAPH_TENANT_ID, GRAPH_CLIENT_ID y GRAPH_CLIENT_SECRET).',
      { status: res.status, code: 'GRAPH_TOKEN_FAILED' }
    )
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new GraphClientError('Respuesta inválida al obtener token de Microsoft Graph.', {
      code: 'GRAPH_TOKEN_PARSE_FAILED'
    })
  }

  const expiresInSec = Number(data.expires_in) || 60
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000
  }
  return tokenCache.accessToken
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.accessToken
  }
  return fetchClientCredentialsToken()
}

class GraphClient {
  /**
   * @param {string} path - Ruta bajo `https://graph.microsoft.com/v1.0`
   * @param {RequestInit} [init]
   */
  async #graphFetch(path, init = {}) {
    const token = await getAccessToken()
    const url = path.startsWith('https://')
      ? path
      : `https://graph.microsoft.com/v1.0${path.startsWith('/') ? path : `/${path}`}`
    const headers = {
      Authorization: `Bearer ${token}`,
      ...init.headers
    }

    return fetch(url, { ...init, headers })
  }

  /**
   * @param {string} email
   * @returns {Promise<{ id: string, fullName: string } | null>}
   * @throws {GraphClientError}
   */
  async findUserByEmail(email) {
    const normalized = normalizeAuthEmail(email)
    if (!normalized) return null

    const escaped = escapeODataString(normalized)
    const filter = `mail eq '${escaped}' or userPrincipalName eq '${escaped}' or otherMails/any(x:x eq '${escaped}')`
    const params = new URLSearchParams({
      $filter: filter,
      $count: 'true',
      $select: 'id,displayName,mail,userPrincipalName'
    })

    const res = await this.#graphFetch(`/users?${params.toString()}`, {
      method: 'GET',
      headers: { ConsistencyLevel: 'eventual' }
    })

    const text = await res.text()
    if (!res.ok) {
      throw mapGraphError(res.status, text)
    }

    let data
    try {
      data = text ? JSON.parse(text) : { value: [] }
    } catch {
      throw new GraphClientError('Respuesta inválida al consultar usuarios en Microsoft Graph.', {
        code: 'GRAPH_PARSE_FAILED'
      })
    }

    const users = Array.isArray(data?.value) ? data.value : []
    if (!users.length) return null

    const user = users[0]
    const id = user?.id ?? null
    if (!id) return null

    const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : ''
    return {
      id,
      fullName: displayName || normalized
    }
  }
}

/**
 * @returns {GraphClient | null}
 */
function getGraphClient() {
  if (!isGraphConfigured()) return null
  if (!clientSingleton) clientSingleton = new GraphClient()
  return clientSingleton
}

function resetGraphClientForTests() {
  clientSingleton = null
  tokenCache = { accessToken: null, expiresAt: 0 }
}

module.exports = {
  getGraphClient,
  isGraphConfigured,
  GraphClientError,
  resetGraphClientForTests
}
