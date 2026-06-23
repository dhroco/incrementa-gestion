/**
 * Test-only legacy navigation helpers (static tree).
 *
 * Runtime navigation and allowed paths MUST come from GET /api/me/session (`navigation` payload),
 * not from a locally hardcoded configuration.
 *
 * Stub simplificado con un único perfil operativo (`ADMINISTRADOR_PLATAFORMA`).
 */

/** @typedef {{ type: 'link', path: string, label: string, moduleTitle: string, profiles: string[] }} NavLinkNode */
/** @typedef {{ path: string, label: string, moduleTitle: string, profiles: string[] }} NavChildLink */
/** @typedef {{ type: 'group', id: string, label: string, children: NavChildLink[] }} NavGroupNode */
/** @typedef {NavLinkNode | NavGroupNode} NavNode */

export const PROFILE_CODES = {
  ADMINISTRADOR_PLATAFORMA: 'ADMINISTRADOR_PLATAFORMA'
}

const P = PROFILE_CODES
const ADMIN_ONLY = [P.ADMINISTRADOR_PLATAFORMA]

/**
 * Full menu tree; visibility is determined per node via `profiles`.
 * @type {NavNode[]}
 */
export const canonicalNavStructure = [
  {
    type: 'link',
    path: '/app/dashboard',
    label: 'Dashboard',
    moduleTitle: 'Dashboard',
    profiles: ADMIN_ONLY
  },
  {
    type: 'link',
    path: '/app/contratos',
    label: 'Contratos',
    moduleTitle: 'Contratos',
    profiles: ADMIN_ONLY
  },
  {
    type: 'link',
    path: '/app/proveedores',
    label: 'Proveedores',
    moduleTitle: 'Proveedores',
    profiles: ADMIN_ONLY
  },
  {
    type: 'link',
    path: '/app/configuracion',
    label: 'Configuración',
    moduleTitle: 'Configuración',
    profiles: ADMIN_ONLY
  },
  {
    type: 'group',
    id: 'administracion',
    label: 'Administración',
    children: [
      {
        path: '/app/usuarios',
        label: 'Usuarios',
        moduleTitle: 'Usuarios',
        profiles: ADMIN_ONLY
      },
      {
        path: '/app/reportes',
        label: 'Reportes',
        moduleTitle: 'Reportes',
        profiles: ADMIN_ONLY
      }
    ]
  }
]

/**
 * Routes available to authenticated users but not necessarily listed as main menu links (header / direct links).
 * @type {{ path: string, moduleTitle: string, profiles: string[] }[]}
 */
export const crossCuttingPrivateRoutes = [
  { path: '/app/mi-perfil', moduleTitle: 'Mi perfil', profiles: ADMIN_ONLY },
  { path: '/app/notificaciones', moduleTitle: 'Notificaciones', profiles: ADMIN_ONLY }
]

/**
 * @param {NavGroupNode} group
 * @param {string} profileCode
 * @returns {NavGroupNode | null}
 */
function filterGroup(group, profileCode) {
  const children = group.children.filter((c) => c.profiles.includes(profileCode))
  if (children.length === 0) return null
  return { ...group, children }
}

/**
 * @param {NavNode} node
 * @param {string} profileCode
 * @returns {NavNode | null}
 */
function filterNode(node, profileCode) {
  if (node.type === 'link') {
    return node.profiles.includes(profileCode) ? node : null
  }
  return filterGroup(node, profileCode)
}

/**
 * Visible sidebar navigation for the given internal profile code.
 * @param {string | null | undefined} profileCode
 * @returns {NavNode[]}
 */
export function getNavForProfile(profileCode) {
  if (!profileCode) return []
  return canonicalNavStructure.map((node) => filterNode(node, profileCode)).filter(Boolean)
}

/**
 * First allowed private path for the profile (landing), aligned with visible menu order.
 * @param {string | null | undefined} profileCode
 * @returns {string}
 */
export function getDefaultPrivatePathForProfile(profileCode) {
  const nav = getNavForProfile(profileCode)
  for (const item of nav) {
    if (item.type === 'link') return item.path
    if (item.type === 'group' && item.children?.length) return item.children[0].path
  }
  return '/app/dashboard'
}

/**
 * Collect all path prefixes allowed for the profile (menu + cross-cutting).
 * @param {string | null | undefined} profileCode
 * @returns {Set<string>}
 */
export function getAllowedPathsForProfile(profileCode) {
  const set = new Set()
  if (!profileCode) return set
  for (const node of getNavForProfile(profileCode)) {
    if (node.type === 'link') set.add(node.path)
    else if (node.type === 'group') {
      for (const c of node.children) set.add(c.path)
    }
  }
  for (const r of crossCuttingPrivateRoutes) {
    if (r.profiles.includes(profileCode)) set.add(r.path)
  }
  return set
}

/**
 * Resolve module title for sub-header; prefers titles visible for the current profile.
 * @param {string} pathname
 * @param {string | null | undefined} profileCode
 * @returns {string}
 */
export function getModuleTitleForPath(pathname, profileCode) {
  if (profileCode) {
    for (const node of getNavForProfile(profileCode)) {
      if (node.type === 'link' && node.path === pathname) return node.moduleTitle
      if (node.type === 'group') {
        const child = node.children.find((c) => c.path === pathname)
        if (child) return child.moduleTitle
      }
    }
    const extra = crossCuttingPrivateRoutes.find(
      (r) => r.path === pathname && r.profiles.includes(profileCode)
    )
    if (extra) return extra.moduleTitle
  }
  for (const node of canonicalNavStructure) {
    if (node.type === 'link' && node.path === pathname) return node.moduleTitle
    if (node.type === 'group') {
      const child = node.children.find((c) => c.path === pathname)
      if (child) return child.moduleTitle
    }
  }
  const fallbackExtra = crossCuttingPrivateRoutes.find((r) => r.path === pathname)
  if (fallbackExtra) return fallbackExtra.moduleTitle
  return 'Módulo'
}
