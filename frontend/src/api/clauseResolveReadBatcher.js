import { apiPost } from './apiClient'

/** @typedef {{ clauseId: string, clauseKind?: 'universal' | 'company', companyId?: string | null }} ClauseReadRef */

/** @type {Map<string, Promise<{ ok: true, content_json: unknown } | { ok: false, status: number, message: string }>>>} */
const inflight = new Map()

/** @type {{ accessToken: string, waiters: Array<{ ref: ClauseReadRef, resolve: (v: any) => void, reject: (e: any) => void }> } | null} */
let pending = null

let flushTimer = null

function refKey(ref) {
  const id = String(ref.clauseId || '').trim()
  const kind = ref.clauseKind === 'company' ? 'company' : 'universal'
  const companyId = typeof ref.companyId === 'string' && ref.companyId.trim().length > 0 ? ref.companyId.trim() : ''
  return `${kind}|${companyId}|${id}`
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushPending()
  }, 0)
}

async function flushPending() {
  const batch = pending
  pending = null
  if (!batch || !Array.isArray(batch.waiters) || batch.waiters.length === 0) return

  const accessToken = batch.accessToken
  if (!accessToken) {
    for (const w of batch.waiters) {
      w.resolve({ ok: false, status: 401, message: 'No se pudo cargar la cláusula (falta sesión).' })
    }
    return
  }

  const uniqueRefs = new Map()
  for (const w of batch.waiters) {
    const k = refKey(w.ref)
    if (!uniqueRefs.has(k)) uniqueRefs.set(k, w.ref)
  }

  const items = [...uniqueRefs.values()].map((r) => ({
    clause_id: String(r.clauseId).trim(),
    clause_kind: r.clauseKind === 'company' ? 'company' : 'universal',
    ...(r.clauseKind === 'company' && r.companyId ? { company_id: String(r.companyId).trim() } : {}),
  }))

  const res = await apiPost('/api/clauses/resolve-read', { items }, { accessToken })
  if (!res.ok) {
    const msg =
      res.status === 403
        ? 'Sin acceso a la cláusula.'
        : res.status === 404
          ? 'Cláusula no disponible.'
          : res.message || 'No se pudo cargar la cláusula.'
    for (const w of batch.waiters) {
      w.resolve({ ok: false, status: res.status, message: msg })
    }
    return
  }

  /** @type {any[]} */
  const resolvedItems = Array.isArray(res.data?.items) ? res.data.items : []
  const byId = new Map()
  for (const it of resolvedItems) {
    const id = typeof it?.clause_id === 'string' ? it.clause_id.trim() : ''
    if (!id) continue
    byId.set(id, it)
  }

  for (const w of batch.waiters) {
    const id = String(w.ref.clauseId || '').trim()
    const it = byId.get(id)
    if (!it) {
      w.resolve({ ok: false, status: 500, message: 'Respuesta inválida del servidor.' })
      continue
    }
    if (!it.ok) {
      const st = typeof it.httpStatus === 'number' ? it.httpStatus : 400
      const msg =
        st === 403
          ? 'Sin acceso a la cláusula.'
          : st === 404
            ? 'Cláusula no disponible.'
            : typeof it.message === 'string' && it.message.trim()
              ? it.message.trim()
              : 'No se pudo cargar la cláusula.'
      w.resolve({ ok: false, status: st, message: msg })
      continue
    }
    const cj = it.clause?.content_json
    w.resolve({ ok: true, content_json: cj })
  }
}

/**
 * Coalesce many concurrent clause reads into a single POST /api/clauses/resolve-read per tick.
 * @param {ClauseReadRef & { accessToken: string }} input
 */
export function resolveClauseContentReadBatched(input) {
  const accessToken = input.accessToken
  const ref = { clauseId: input.clauseId, clauseKind: input.clauseKind, companyId: input.companyId }

  const k = refKey({ ...ref, clauseId: ref.clauseId })
  const existing = inflight.get(k)
  if (existing) return existing

  const p = new Promise((resolve, reject) => {
    if (!pending || pending.accessToken !== accessToken) {
      pending = { accessToken, waiters: [] }
    }
    pending.waiters.push({ ref, resolve, reject })
    scheduleFlush()
  }).finally(() => {
    inflight.delete(k)
  })

  inflight.set(k, p)
  return p
}
