function normalizeTrailingSlash(pathname) {
  const s = String(pathname || '')
  const noTrail = s.replace(/\/$/, '')
  return noTrail || '/'
}

/**
 * Normalize a backend-provided routePath.
 * @param {string} routePath
 * @returns {string}
 */
export function normalizeRoutePath(routePath) {
  return normalizeTrailingSlash(routePath)
}
