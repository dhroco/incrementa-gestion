import {
  buildEffectivePrivateAllowedPathSet,
  getDefaultPrivatePathFromRoutes,
  isPathAllowed
} from '../navigation/authorizationSelectors'

function normalizePath(p) {
  return (p || '/').replace(/\/$/, '') || '/'
}

/**
 * Pure decision function for route guard behavior.
 * @param {{ pathname: string, enrichmentStatus: string, routes: Array<{ routePath?: string | null }> | null | undefined }} input
 * @returns {{ type: 'allow' } | { type: 'redirect', to: string }}
 */
export function decidePrivateNavigation({ pathname, enrichmentStatus, routes }) {
  const path = normalizePath(pathname)

  // Only enforce after successful enrichment (when we have effective authorization)
  if (enrichmentStatus !== 'succeeded') return { type: 'allow' }

  // Access denied route must always be reachable once authenticated
  if (path === '/app/acceso-denegado') return { type: 'allow' }

  const allowed = buildEffectivePrivateAllowedPathSet(routes)
  const resolvedDefault = getDefaultPrivatePathFromRoutes(routes)
  const defaultPath = normalizePath(resolvedDefault || '/app/acceso-denegado')

  // /app → send to default allowed destination (or acceso denegado si no hay routePath válido)
  if (path === '/app') return { type: 'redirect', to: defaultPath }

  // Con enrichment OK y rutas no vacías, PrivateAppGate ya pasó: un allow set vacío implica
  // datos inconsistentes (p. ej. routePath nulos); no abrir el shell a cualquier URL.
  if (!allowed.size) {
    return { type: 'redirect', to: '/app/acceso-denegado' }
  }

  if (!isPathAllowed(path, allowed)) {
    return { type: 'redirect', to: '/app/acceso-denegado' }
  }

  return { type: 'allow' }
}

