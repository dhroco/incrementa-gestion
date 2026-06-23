function normalizeTrailingSlash(pathname) {
  const s = String(pathname || '')
  const noTrail = s.replace(/\/$/, '')
  return noTrail || '/'
}

export const MENU_CONFIG = [
  {
    id: 'inicio',
    label: 'Inicio',
    children: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/app/dashboard',
        navCode: 'NAV_ITEM_INICIO_DASHBOARD',
        moduleTitle: 'Dashboard',
        check: null
      }
    ]
  },
  {
    id: 'admin_global',
    label: 'Administración Global',
    children: [
      {
        id: 'empresas',
        label: 'Empresas',
        path: '/app/admin-global/empresas',
        navCode: 'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS',
        moduleTitle: 'Empresas',
        check: { action: 'read', subject: 'Company' }
      },
      {
        id: 'roles_permisos',
        label: 'Roles y permisos',
        path: '/app/admin-global/roles-permisos',
        navCode: 'NAV_ITEM_SISTEMA_ROLES_PERMISOS',
        moduleTitle: 'Roles y permisos',
        check: { action: 'read', subject: 'RolePermission' }
      },
      {
        id: 'usuarios',
        label: 'Usuarios',
        path: '/app/admin-global/usuarios-plataforma',
        navCode: 'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA',
        moduleTitle: 'Usuarios',
        check: { action: 'read', subject: 'PlatformUser' }
      },
      {
        id: 'proveedores',
        label: 'Proveedores',
        path: '/app/proveedores',
        navCode: 'NAV_ITEM_PROVEEDORES_PROVEEDORES',
        moduleTitle: 'Proveedores',
        check: { action: 'read', subject: 'Supplier' }
      },
      {
        id: 'clientes',
        label: 'Clientes',
        path: '/app/admin-global/clientes',
        navCode: 'NAV_ITEM_ADMIN_GLOBAL_CLIENTES',
        moduleTitle: 'Clientes',
        check: { action: 'read', subject: 'Client' }
      }
    ]
  },
  {
    id: 'gestion_contratos',
    label: 'Gestión de Contratos',
    children: [
      {
        id: 'plantillas',
        label: 'Plantillas',
        path: '/app/gestion-contratos/templates-estandar',
        navCode: 'NAV_ITEM_CONTRATOS_PLANTILLAS',
        moduleTitle: 'Plantillas',
        check: { action: 'read', subject: 'Template' }
      },
      {
        id: 'constructor_documento',
        label: 'Constructor de documento',
        path: '/app/gestion-contratos/constructor-documento',
        navCode: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO',
        moduleTitle: 'Constructor de documento',
        check: { action: 'use', subject: 'DocumentBuilder' }
      },
      {
        id: 'firma_documento',
        label: 'Firma de documento',
        path: '/app/gestion-contratos/firma-documento',
        navCode: 'NAV_ITEM_CONTRATOS_FIRMA',
        moduleTitle: 'Firma de documento',
        check: { action: 'sign', subject: 'Contract' }
      },
      {
        id: 'consulta_contratos',
        label: 'Consulta contratos',
        path: '/app/gestion-contratos/consulta-contratos',
        navCode: 'NAV_ITEM_CONTRATOS_CONSULTA',
        moduleTitle: 'Consulta contratos',
        check: { action: 'read', subject: 'Contract' }
      }
    ]
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    children: [
      {
        id: 'mi_perfil',
        label: 'Mi perfil',
        path: '/app/mi-perfil',
        navCode: 'NAV_MI_PERFIL',
        moduleTitle: 'Mi perfil',
        check: null
      }
    ]
  }
]

/** Flat list of menu items with paths for title/icon lookup. */
export function getAllMenuItems() {
  const items = []
  for (const group of MENU_CONFIG) {
    for (const child of group.children) {
      items.push(child)
    }
  }
  return items
}

/**
 * Resolve module title for pathname from static menu config.
 * @param {string} pathname
 * @returns {string | null}
 */
export function getModuleTitleFromMenuConfig(pathname) {
  const normalized = normalizeTrailingSlash(pathname)
  const items = getAllMenuItems().filter((item) => item.path)

  const exact = items.find((item) => normalizeTrailingSlash(item.path) === normalized)
  if (exact?.moduleTitle) return exact.moduleTitle

  let best = null
  let bestLen = -1
  for (const item of items) {
    const base = normalizeTrailingSlash(item.path)
    if (normalized === base || normalized.startsWith(`${base}/`)) {
      if (base.length > bestLen) {
        bestLen = base.length
        best = item
      }
    }
  }
  return best?.moduleTitle ?? best?.label ?? null
}

/**
 * Resolve nav match (code, routePath) for subheader icon from static menu.
 * @param {string} pathname
 * @returns {{ code: string | null, routePath: string | null, moduleTitle?: string } | null}
 */
export function resolveMenuMatchForPathname(pathname) {
  const normalized = normalizeTrailingSlash(pathname)
  const items = getAllMenuItems().filter((item) => item.path)

  let best = null
  let bestLen = -1
  for (const item of items) {
    const base = normalizeTrailingSlash(item.path)
    if (normalized === base || normalized.startsWith(`${base}/`)) {
      if (base.length > bestLen) {
        bestLen = base.length
        best = item
      }
    }
  }
  if (!best) return null
  return {
    code: best.navCode ?? null,
    routePath: best.path,
    moduleTitle: best.moduleTitle ?? best.label
  }
}

/**
 * Build sidebar structure from MENU_CONFIG filtered by ability.can checks.
 * @param {(action: string, subject: string) => boolean} can
 */
export function buildVisibleMenuFromConfig(can) {
  return MENU_CONFIG.map((group) => ({
    ...group,
    children: group.children.filter(
      (item) => item.check === null || can(item.check.action, item.check.subject)
    )
  })).filter((group) => group.children.length > 0)
}

/**
 * Map visible menu groups to sidebar render items (compatible with AppSidebar structure).
 * @param {ReturnType<typeof buildVisibleMenuFromConfig>} visibleMenu
 */
export function mapMenuConfigToSidebarItems(visibleMenu) {
  return visibleMenu.map((group) => ({
    type: 'group',
    id: group.id,
    label: group.label,
    children: group.children.map((child) => ({
      id: child.navCode ?? child.id,
      label: child.label,
      path: child.path
    }))
  }))
}

export const DEFAULT_PRIVATE_PATH = '/app/dashboard'
