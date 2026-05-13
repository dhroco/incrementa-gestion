/**
 * Helpers for authorization payload from GET /api/me/session (navigation.tree / navigation.routes).
 * Fuente de verdad en runtime: sesión enriquecida; no usar menú estático para producción.
 * @typedef {{ code: string, label: string, routePath?: string | null, moduleTitle?: string, showInMainMenu?: boolean, sortOrder?: number, children?: ApiNavNode[] }} ApiNavNode
 */

const PRIVATE_APP_PREFIX = '/app/'

function normalizeTrailingSlash(pathname) {
  const s = String(pathname || '')
  const noTrail = s.replace(/\/$/, '')
  return noTrail || '/'
}

/**
 * Normalize a backend-provided routePath.
 * - remove trailing slash
 * - keep "/" if empty
 * @param {string} routePath
 * @returns {string}
 */
export function normalizeRoutePath(routePath) {
  return normalizeTrailingSlash(routePath)
}

/**
 * @param {string} routePath
 * @returns {boolean}
 */
export function isValidPrivateModuleRoutePath(routePath) {
  const n = normalizeRoutePath(routePath)
  return n.startsWith(PRIVATE_APP_PREFIX) && n.length > PRIVATE_APP_PREFIX.length
}

/**
 * @param {Array<{ routePath?: string | null }> | null | undefined} routes
 * @returns {Set<string>}
 */
export function buildAllowedPathSet(routes) {
  const set = new Set()
  if (!routes || !Array.isArray(routes)) return set
  for (const r of routes) {
    if (r && typeof r.routePath === 'string' && isValidPrivateModuleRoutePath(r.routePath)) {
      set.add(normalizeRoutePath(r.routePath))
    }
  }
  return set
}

/**
 * Shell + guard: every private path under `/app/*` that the signed-in user may open
 * MUST appear in this set, derived only from `navigation.routes` (session enriquecida).
 * Rutas fijas del producto (`/app/dashboard`, `/app/contratos`, …) no son paralelas al
 * backend: entran aquí solo si vienen en `routes` con `routePath` válido (misma fuente que el menú).
 */
export function buildEffectivePrivateAllowedPathSet(routes) {
  return buildAllowedPathSet(routes)
}

/**
 * First suitable landing: prefer first route with showInMainMenu !== false, else first route.
 * @param {Array<{ routePath?: string | null, showInMainMenu?: boolean, sortOrder?: number }> | null | undefined} routes
 * @returns {string | null}
 */
export function getDefaultPrivatePathFromRoutes(routes) {
  if (!routes || routes.length === 0) return null
  const sorted = [...routes].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.code).localeCompare(String(b.code))
  )
  const main = sorted.find((r) => r.showInMainMenu !== false && typeof r.routePath === 'string' && isValidPrivateModuleRoutePath(r.routePath))
  if (main?.routePath) return normalizeRoutePath(main.routePath)
  const any = sorted.find((r) => typeof r.routePath === 'string' && isValidPrivateModuleRoutePath(r.routePath))
  return any?.routePath ? normalizeRoutePath(any.routePath) : null
}

/**
 * Segment relative to `/app/` for React Router `path` (e.g. `dashboard`, `contratos/foo`).
 * @param {Array<{ routePath?: string | null, showInMainMenu?: boolean, sortOrder?: number, code?: string }> | null | undefined} routes
 * @returns {string | null}
 */
export function getDefaultPrivateRelativePathFromRoutes(routes) {
  const abs = getDefaultPrivatePathFromRoutes(routes)
  if (!abs) return null
  const n = normalizeRoutePath(abs)
  if (!n.startsWith(PRIVATE_APP_PREFIX) || n.length <= PRIVATE_APP_PREFIX.length) return null
  return n.slice(PRIVATE_APP_PREFIX.length)
}

/**
 * @param {string} pathname
 * @param {Array<{ routePath?: string | null, moduleTitle?: string, label?: string }> | null | undefined} routes
 * @returns {string}
 */
export function getModuleTitleFromAuthorizationRoutes(pathname, routes) {
  const n = normalizeRoutePath(pathname)
  if (!routes) return 'Módulo'
  const hit = routes.find((r) => typeof r.routePath === 'string' && normalizeRoutePath(r.routePath) === n)
  if (hit) return hit.moduleTitle || hit.label || 'Módulo'
  let best = null
  let bestLen = -1
  for (const r of routes) {
    if (typeof r.routePath !== 'string') continue
    const p = normalizeRoutePath(r.routePath)
    if (!isValidPrivateModuleRoutePath(p)) continue
    if (n === p || (n.length > p.length && n.startsWith(`${p}/`))) {
      if (p.length > bestLen) {
        bestLen = p.length
        best = r
      }
    }
  }
  if (best) return best.moduleTitle || best.label || 'Módulo'
  return 'Módulo'
}

/**
 * Longest-prefix match for the current pathname against `navigation.routes` (same strategy as
 * {@link getModuleTitleFromAuthorizationRoutes}), returning structured fields for shell UI.
 *
 * @param {string} pathname
 * @param {Array<{ routePath?: string | null, moduleTitle?: string, label?: string, code?: string | null }> | null | undefined} routes
 * @returns {{ routePath: string, moduleTitle?: string, label?: string, code: string | null } | null}
 */
export function resolveNavRouteMatchForPathname(pathname, routes) {
  const n = normalizeRoutePath(pathname)
  if (!routes) return null
  const exact = routes.find((r) => typeof r.routePath === 'string' && normalizeRoutePath(r.routePath) === n)
  if (exact && typeof exact.routePath === 'string') {
    const p = normalizeRoutePath(exact.routePath)
    return {
      routePath: p,
      moduleTitle: exact.moduleTitle,
      label: exact.label,
      code: typeof exact.code === 'string' ? exact.code : null
    }
  }
  let best = null
  let bestLen = -1
  for (const r of routes) {
    if (typeof r.routePath !== 'string') continue
    const p = normalizeRoutePath(r.routePath)
    if (!isValidPrivateModuleRoutePath(p)) continue
    if (n === p || (n.length > p.length && n.startsWith(`${p}/`))) {
      if (p.length > bestLen) {
        bestLen = p.length
        best = r
      }
    }
  }
  if (!best || typeof best.routePath !== 'string') return null
  const p = normalizeRoutePath(best.routePath)
  return {
    routePath: p,
    moduleTitle: best.moduleTitle,
    label: best.label,
    code: typeof best.code === 'string' ? best.code : null
  }
}

/**
 * Permite rutas hijas de una ruta concedida (p. ej. `/app/.../clausulas-universales/uuid/edit`
 * cuando el menú solo declara `/app/.../clausulas-universales`).
 * @param {string} pathname
 * @param {Set<string>} allowed
 */
export function isPathAllowed(pathname, allowed) {
  const n = normalizeRoutePath(pathname)
  if (allowed.has(n)) return true
  for (const p of allowed) {
    if (typeof p !== 'string' || p.length === 0) continue
    const base = normalizeRoutePath(p)
    if (n.length > base.length && n.startsWith(`${base}/`)) return true
  }
  return false
}

/**
 * Build deterministic, deduplicated module route definitions from navigation.routes.
 * Only includes private module paths under /app/* (excluding "/app").
 *
 * @param {Array<{ code?: string, label?: string, moduleTitle?: string, routePath?: string | null, sortOrder?: number }> | null | undefined} routes
 * @param {{ excludeRelativePaths?: Set<string> }} [opts]
 * @returns {Array<{ absolutePath: string, relativePath: string, title: string, code: string | null }>}
 */
export function buildPrivateModuleRouteDefinitions(routes, opts = {}) {
  const excludeRelativePaths = opts.excludeRelativePaths ?? new Set()
  if (!routes || !Array.isArray(routes) || routes.length === 0) return []

  const sorted = [...routes].sort((a, b) => {
    const d = (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0)
    if (d !== 0) return d
    const ca = String(a?.code ?? '')
    const cb = String(b?.code ?? '')
    const c = ca.localeCompare(cb)
    if (c !== 0) return c
    return String(a?.routePath ?? '').localeCompare(String(b?.routePath ?? ''))
  })

  const seen = new Set()
  const out = []
  for (const r of sorted) {
    if (!r || typeof r.routePath !== 'string') continue
    if (!isValidPrivateModuleRoutePath(r.routePath)) continue

    const absolutePath = normalizeRoutePath(r.routePath)
    if (seen.has(absolutePath)) continue
    seen.add(absolutePath)

    const relativePath = absolutePath.slice(PRIVATE_APP_PREFIX.length)
    if (!relativePath || excludeRelativePaths.has(relativePath)) continue

    out.push({
      absolutePath,
      relativePath,
      title: r.moduleTitle || r.label || 'Módulo',
      code: typeof r.code === 'string' ? r.code : null
    })
  }
  return out
}

/**
 * Build sidebar-ready structure from API tree (only showInMainMenu for leaves; groups keep children).
 * @param {ApiNavNode[] | null | undefined} tree
 * @returns {Array<
 *  | { type: 'link', path: string, label: string }
 *  | { type: 'group', id: string, label: string, children: { id: string, path: string | null, label: string }[] }
 * >}
 */
export function mapApiNavTreeToSidebarItems(tree) {
  if (!tree || !Array.isArray(tree)) return []

  const out = []
  for (const node of tree) {
    if (node.children && node.children.length > 0) {
      const childLinks = node.children
        .filter((c) => c.showInMainMenu !== false)
        .map((c) => ({
          id: c.code,
          path: typeof c.routePath === 'string' ? normalizeRoutePath(c.routePath) : null,
          label: c.label
        }))
      if (childLinks.length > 0) {
        out.push({
          type: 'group',
          id: node.code,
          label: node.label,
          children: childLinks
        })
      }
      continue
    }
    if (typeof node.routePath === 'string' && node.showInMainMenu !== false) {
      out.push({
        type: 'link',
        path: normalizeRoutePath(node.routePath),
        label: node.label
      })
    }
  }
  return out
}

/**
 * Build a Set of granted navigation codes from navigation.tree (includes non-route action nodes).
 * @param {Array<any> | null | undefined} tree
 * @returns {Set<string>}
 */
export function buildGrantedCodeSetFromTree(tree) {
  const out = new Set()
  const stack = Array.isArray(tree) ? [...tree] : []
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (typeof node.code === 'string' && node.code) out.add(node.code)
    if (Array.isArray(node.children)) {
      for (const c of node.children) stack.push(c)
    }
  }
  return out
}

/**
 * Codes the session allows (from `navigation.tree` plus all `grantedCodes` from the server).
 * Action nodes without routes may be omitted from the pruned tree but are still in `grantedCodes`.
 * @param {{ tree?: unknown[], grantedCodes?: string[] } | null | undefined} navigation
 * @returns {Set<string>}
 */
export function buildGrantedCodeSetFromSession(navigation) {
  const s = buildGrantedCodeSetFromTree(navigation?.tree)
  if (Array.isArray(navigation?.grantedCodes)) {
    for (const c of navigation.grantedCodes) {
      if (typeof c === 'string' && c) s.add(c)
    }
  }
  return s
}
