const config = require('../config')

/**
 * Cliente Keycloak Admin REST: la aplicación solo consulta identidades (lookup por email)
 * y actualiza correo. Creación de usuarios, credenciales y borrado desde flujos HTTP
 * fueron retirados; `deleteUser` se mantiene para scripts operativos (p. ej. delete-app-user.js).
 */

const TOKEN_REFRESH_MARGIN_MS = 10_000

/** @type {{ accessToken: string | null, expiresAt: number }} */
let tokenCache = { accessToken: null, expiresAt: 0 }

/** @type {KeycloakAdminClient | null} */
let clientSingleton = null

class KeycloakAdminError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string }} [opts]
   */
  constructor(message, opts = {}) {
    super(message)
    this.name = 'KeycloakAdminError'
    this.status = opts.status
    this.code = opts.code
  }
}

function isKeycloakAdminConfigured() {
  return Boolean(
    config.KEYCLOAK_ADMIN_URL &&
      config.KEYCLOAK_ADMIN_PASSWORD &&
      config.KEYCLOAK_REALM
  )
}

function getRealmAdminBaseUrl() {
  const base = String(config.KEYCLOAK_ADMIN_URL).replace(/\/$/, '')
  return `${base}/admin/realms/${config.KEYCLOAK_REALM}`
}

function mapKeycloakError(status, bodyText) {
  if (status === 409) {
    return new KeycloakAdminError('Ya existe un usuario con ese correo.', { status, code: 'DUPLICATE' })
  }
  if (status === 404) {
    return new KeycloakAdminError('Usuario no encontrado en Keycloak.', { status, code: 'NOT_FOUND' })
  }
  let detail = ''
  try {
    const parsed = JSON.parse(bodyText)
    detail = parsed?.errorMessage || parsed?.error || ''
  } catch {
    detail = bodyText?.slice(0, 200) || ''
  }
  const suffix = detail ? ` (${detail})` : ''
  return new KeycloakAdminError(`Error del servicio de autenticación${suffix}.`, {
    status,
    code: 'KEYCLOAK_ADMIN_ERROR'
  })
}

async function fetchMasterAdminToken() {
  const base = String(config.KEYCLOAK_ADMIN_URL).replace(/\/$/, '')
  const url = `${base}/realms/master/protocol/openid-connect/token`
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: config.KEYCLOAK_ADMIN_USER || 'admin',
    password: config.KEYCLOAK_ADMIN_PASSWORD
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const text = await res.text()
  if (!res.ok) {
    throw new KeycloakAdminError(
      'No se pudo autenticar contra Keycloak Admin (revise KEYCLOAK_ADMIN_URL, usuario y contraseña).',
      { status: res.status, code: 'ADMIN_TOKEN_FAILED' }
    )
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new KeycloakAdminError('Respuesta inválida al obtener token de administración de Keycloak.', {
      code: 'ADMIN_TOKEN_PARSE_FAILED'
    })
  }

  const expiresInSec = Number(data.expires_in) || 60
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000
  }
  return tokenCache.accessToken
}

async function getAdminAccessToken() {
  if (
    tokenCache.accessToken &&
    Date.now() < tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS
  ) {
    return tokenCache.accessToken
  }
  return fetchMasterAdminToken()
}

class KeycloakAdminClient {
  /**
   * @param {string} path - Ruta bajo `/admin/realms/{realm}` (p. ej. `/users`)
   * @param {RequestInit} [init]
   */
  async #adminFetch(path, init = {}) {
    const token = await getAdminAccessToken()
    const url = `${getRealmAdminBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }

    const res = await fetch(url, { ...init, headers })
    return res
  }

  /**
   * @param {string} path
   * @param {RequestInit} init
   */
  async #adminJson(path, init = {}) {
    const res = await this.#adminFetch(path, init)
    const text = await res.text()
    if (!res.ok) {
      throw mapKeycloakError(res.status, text)
    }
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  // eliminado en refactor IdP — creación de usuarios solo en Keycloak Admin Console
  // async createUser({ email, password, firstName, lastName }) { ... }

  /**
   * Solo para scripts operativos (p. ej. `scripts/delete-app-user.js`), no para flujos HTTP.
   * @param {string} userId
   */
  async deleteUser(userId) {
    const res = await this.#adminFetch(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
    if (res.status === 204 || res.status === 404) return
    const text = await res.text()
    throw mapKeycloakError(res.status, text)
  }

  /**
   * @param {string} userId
   * @param {string} email
   */
  async updateUserEmail(userId, email) {
    const existing = await this.#adminJson(`/users/${encodeURIComponent(userId)}`, { method: 'GET' })
    if (!existing) {
      throw new KeycloakAdminError('Usuario no encontrado en Keycloak.', { status: 404, code: 'NOT_FOUND' })
    }

    await this.#adminJson(`/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: existing.id,
        username: email,
        email,
        emailVerified: true,
        enabled: existing.enabled !== false,
        firstName: existing.firstName,
        lastName: existing.lastName
      })
    })
  }

  // eliminado en refactor IdP — contraseñas gestionadas en Keycloak
  // async resetUserPassword(userId, newPassword) { ... }

  /**
   * @param {string} email - Correo normalizado
   * @returns {Promise<{ id: string, fullName: string } | null>} UUID y nombre si existe; null si no hay coincidencia
   * @throws {KeycloakAdminError} Si Keycloak Admin responde con error (red, token, etc.)
   */
  async findUserIdByEmail(email) {
    const q = new URLSearchParams({ email, exact: 'true' })
    const users = await this.#adminJson(`/users?${q.toString()}`, { method: 'GET' })
    if (!Array.isArray(users) || !users.length) return null
    const user = users[0]
    const id = user?.id ?? null
    if (!id) return null
    return {
      id,
      fullName: buildFullNameFromKeycloakUser(user, email)
    }
  }
}

/**
 * @returns {KeycloakAdminClient | null}
 */
function getKeycloakAdminClient() {
  if (!isKeycloakAdminConfigured()) return null
  if (!clientSingleton) clientSingleton = new KeycloakAdminClient()
  return clientSingleton
}

/**
 * @param {{ firstName?: string, lastName?: string } | null | undefined} user
 * @param {string} emailFallback
 * @returns {string}
 */
function buildFullNameFromKeycloakUser(user, emailFallback) {
  const parts = [user?.firstName, user?.lastName]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  return parts.length ? parts.join(' ') : emailFallback
}

function splitFullName(fullName) {
  const trimmed = String(fullName || '').trim()
  if (!trimmed) return { firstName: undefined, lastName: undefined }
  const parts = trimmed.split(/\s+/)
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined
  }
}

function resetKeycloakAdminClientForTests() {
  clientSingleton = null
  tokenCache = { accessToken: null, expiresAt: 0 }
}

module.exports = {
  getKeycloakAdminClient,
  buildFullNameFromKeycloakUser,
  splitFullName,
  KeycloakAdminError,
  resetKeycloakAdminClientForTests
}
