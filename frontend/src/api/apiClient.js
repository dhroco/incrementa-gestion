import appConfig from '../../config.js'
import { store } from '../store/store'
import { invalidateSessionThunk } from '../store/authSlice'

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
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
 * @returns {Promise<
 *   | { ok: true, status: number, data: unknown, meta: unknown }
 *   | { ok: false, status: number, kind: string, code?: string | null, message: string }
 * >}
 */
export async function apiGet(path, options = {}) {
  const { accessToken, signal, headers: extraHeaders } = options
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
      // Global session invalidation (best-effort) to avoid inconsistent private rendering.
      store.dispatch(invalidateSessionThunk({ reason: 'unauthorized' }))
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
  const { accessToken, signal, headers: extraHeaders } = options
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
      return { ok: true, status: res.status, data, meta }
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
      store.dispatch(invalidateSessionThunk({ reason: 'unauthorized' }))
    }

    const missingFieldKeys =
      responseBody &&
      typeof responseBody === 'object' &&
      responseBody.error &&
      Array.isArray(responseBody.error.missingFieldKeys)
        ? responseBody.error.missingFieldKeys
        : undefined

    return {
      ok: false,
      status: res.status,
      kind,
      code: codeFromBody,
      message: messageFromBody || mapHttpStatusToSpanish(res.status),
      ...(missingFieldKeys ? { missingFieldKeys } : {})
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

