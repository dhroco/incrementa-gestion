const config = require('../config')
const { getAzureCredential } = require('./azureCredential')

const { normalizeAuthEmail } = require('./normalizeAuthEmail')

/**
 * Cliente Microsoft Graph (app-only): lookup de usuarios por email en solo lectura.
 *
 * El token lo pide la credencial de Azure: en Azure, la managed identity del backend, que
 * tiene el permiso de aplicación `User.Read.All` en su tenant; en local, la sesión de
 * `az login`. No hay client secret.
 */

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default'
const TOKEN_REFRESH_MARGIN_MS = 60_000

/** @type {{ accessToken: string | null, expiresAt: number }} */
let tokenCache = { accessToken: null, expiresAt: 0 }

/** @type {GraphClient | null} */
let clientSingleton = null

/** Credencial inyectada por las pruebas; en uso normal es la de lib/azureCredential. */
let credentialOverride = null

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
  return config.GRAPH_ENABLED !== false
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

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.accessToken
  }
  const credential = credentialOverride ?? getAzureCredential()
  let result
  try {
    result = await credential.getToken(GRAPH_SCOPE)
  } catch {
    result = null
  }
  if (!result?.token) {
    throw new GraphClientError(
      'No se pudo obtener un token para Microsoft Graph (revise la identidad del backend y su permiso User.Read.All).',
      { code: 'GRAPH_TOKEN_FAILED' }
    )
  }
  tokenCache = {
    accessToken: result.token,
    expiresAt: Number(result.expiresOnTimestamp) || Date.now() + 60_000
  }
  return tokenCache.accessToken
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

/**
 * @param {{ credential?: { getToken: (scope: string) => Promise<{ token: string, expiresOnTimestamp: number } | null> } | null }} [opts]
 */
function resetGraphClientForTests({ credential = null } = {}) {
  clientSingleton = null
  tokenCache = { accessToken: null, expiresAt: 0 }
  credentialOverride = credential
}

module.exports = {
  getGraphClient,
  isGraphConfigured,
  GraphClientError,
  resetGraphClientForTests
}
