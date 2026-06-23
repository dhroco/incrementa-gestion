import appConfig from '../../config.js'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { acquireApiAccessToken, getActiveMsalAccount } from '../auth/msalToken'
import { API_SCOPE } from '../config/msalConfig'
import { msalInstance } from '../auth/msalInstance'
import { store } from '../store/store'
import { signOutThunk } from '../store/authSlice'

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

async function resolveAccessToken(optionsAccessToken) {
  if (optionsAccessToken) return optionsAccessToken
  return acquireApiAccessToken()
}

async function handleUnauthorized() {
  const account = getActiveMsalAccount()
  if (!account) {
    await store.dispatch(signOutThunk({ reason: 'unauthorized' }))
    return
  }

  try {
    const token = await acquireApiAccessToken()
    if (!token) {
      return
    }
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({
        scopes: [API_SCOPE],
        account
      })
      return
    }
    await store.dispatch(signOutThunk({ reason: 'unauthorized' }))
  }
}

export function mapHttpStatusToSpanish(status) {
  if (status === 401) return 'No autorizado. Inicie sesión nuevamente.'
  if (status === 403) return 'Acceso denegado. No tiene permisos para ver esta información.'
  if (status === 404) return 'No se encontró el recurso solicitado.'
  if (status === 409) {
    return 'El dato entra en conflicto con un registro existente (por ejemplo, un RUT de empresa ya registrado).'
  }
  if (status >= 500) return 'Ocurrió un error en el servidor. Intente nuevamente.'
  return 'No se pudo completar la solicitud. Intente nuevamente.'
}

export function classifyApiFailure(status) {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * @param {string} path
 * @param {{ accessToken?: string | null, signal?: AbortSignal, headers?: Record<string, string> }} [options]
 */
export async function apiGet(path, options = {}) {
  const { signal, headers: extraHeaders } = options
  const accessToken = await resolveAccessToken(options.accessToken)
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {})
      },
      signal
    })

    const body = await res.json().catch(() => ({}))

    if (res.ok) {
      const data = body && typeof body === 'object' ? body.data : null
      const meta = body && typeof body === 'object' ? body.meta : null
      return { ok: true, status: res.status, data, meta }
    }

    const messageFromBody =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : body && typeof body === 'object' && typeof body.message === 'string'
          ? body.message
          : null
    const codeFromBody =
      body && typeof body === 'object' && body.error && typeof body.error.code === 'string' ? body.error.code : null

    const kind = classifyApiFailure(res.status)
    if (kind === 'unauthorized') {
      await handleUnauthorized()
    }

    return {
      ok: false,
      status: res.status,
      kind,
      code: codeFromBody,
      message: messageFromBody || mapHttpStatusToSpanish(res.status)
    }
  } catch (e) {
    if (e && typeof e === 'object' && e.name === 'AbortError') {
      return { ok: false, status: 0, kind: 'aborted', message: 'Solicitud cancelada.' }
    }
    return {
      ok: false,
      status: 0,
      kind: 'network',
      message: 'No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.'
    }
  }
}

async function apiSendJson(method, path, body, options = {}) {
  const { signal, headers: extraHeaders } = options
  const accessToken = await resolveAccessToken(options.accessToken)
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body ?? {}),
      signal
    })

    const responseBody = await res.json().catch(() => ({}))

    if (res.ok) {
      const data = responseBody && typeof responseBody === 'object' ? responseBody.data : null
      const meta = responseBody && typeof responseBody === 'object' ? responseBody.meta : null
      const message =
        responseBody && typeof responseBody === 'object' && typeof responseBody.message === 'string'
          ? responseBody.message
          : null
      return { ok: true, status: res.status, data, meta, message }
    }

    const messageFromBody =
      responseBody &&
      typeof responseBody === 'object' &&
      responseBody.error &&
      typeof responseBody.error.message === 'string'
        ? responseBody.error.message
        : responseBody && typeof responseBody === 'object' && typeof responseBody.message === 'string'
          ? responseBody.message
          : null
    const codeFromBody =
      responseBody &&
      typeof responseBody === 'object' &&
      responseBody.error &&
      typeof responseBody.error.code === 'string'
        ? responseBody.error.code
        : null

    const kind = classifyApiFailure(res.status)
    if (kind === 'unauthorized') {
      await handleUnauthorized()
    }

    const metaFromBody =
      responseBody && typeof responseBody === 'object' && responseBody.meta && typeof responseBody.meta === 'object'
        ? responseBody.meta
        : undefined

    const missingFields =
      metaFromBody && Array.isArray(metaFromBody.missingFields) ? metaFromBody.missingFields : undefined

    const existingFromBody =
      responseBody &&
      typeof responseBody === 'object' &&
      responseBody.error &&
      responseBody.error.existing &&
      typeof responseBody.error.existing === 'object'
        ? responseBody.error.existing
        : undefined

    const existing =
      existingFromBody ??
      (metaFromBody?.existing && typeof metaFromBody.existing === 'object' ? metaFromBody.existing : undefined)

    return {
      ok: false,
      status: res.status,
      kind,
      code: codeFromBody,
      message: messageFromBody || mapHttpStatusToSpanish(res.status),
      ...(missingFields ? { missingFields } : {}),
      ...(metaFromBody ? { meta: metaFromBody } : {}),
      ...(existing ? { existing } : {})
    }
  } catch (e) {
    if (e && typeof e === 'object' && e.name === 'AbortError') {
      return { ok: false, status: 0, kind: 'aborted', message: 'Solicitud cancelada.' }
    }
    return {
      ok: false,
      status: 0,
      kind: 'network',
      message: 'No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.'
    }
  }
}

export async function apiPost(path, body, options = {}) {
  return apiSendJson('POST', path, body, options)
}

export async function apiPut(path, body, options = {}) {
  return apiSendJson('PUT', path, body, options)
}

export async function apiDelete(path, options = {}) {
  const { signal, headers: extraHeaders } = options
  const accessToken = await resolveAccessToken(options.accessToken)
  const baseUrl = normalizeBaseUrl(appConfig.API_BASE_URL)
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {})
      },
      signal
    })

    const body = await res.json().catch(() => ({}))

    if (res.ok) {
      const data = body && typeof body === 'object' ? body.data : null
      const meta = body && typeof body === 'object' ? body.meta : null
      return { ok: true, status: res.status, data, meta }
    }

    const messageFromBody =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : body && typeof body === 'object' && typeof body.message === 'string'
          ? body.message
          : null
    const codeFromBody =
      body && typeof body === 'object' && body.error && typeof body.error.code === 'string' ? body.error.code : null

    const kind = classifyApiFailure(res.status)
    if (kind === 'unauthorized') {
      await handleUnauthorized()
    }

    return {
      ok: false,
      status: res.status,
      kind,
      code: codeFromBody,
      message: messageFromBody || mapHttpStatusToSpanish(res.status)
    }
  } catch (e) {
    if (e && typeof e === 'object' && e.name === 'AbortError') {
      return { ok: false, status: 0, kind: 'aborted', message: 'Solicitud cancelada.' }
    }
    return {
      ok: false,
      status: 0,
      kind: 'network',
      message: 'No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.'
    }
  }
}
