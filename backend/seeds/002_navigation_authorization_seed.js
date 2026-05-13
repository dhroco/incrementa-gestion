/**
 * Navigation nodes + profile grants aligned with the database-backed navigation policy.
 *
 * Idempotent strategy:
 * - Upsert navigation nodes by stable `code` (no destructive truncation).
 * - Replace grants for the profiles within this seed scope (by node codes list).
 *
 * Optional cleanup (rollback helper for test envs):
 * - If `NAV_SEED_CLEANUP=1`, the seed will delete grants + nodes for the codes in `CODES_IN_SCOPE`
 *   and then exit. This is NOT enabled by default.
 */

// NOTE: New codes use NAV_MENU_/NAV_ITEM_ prefixes to avoid collisions with legacy NAV_* codes.
const CODES_IN_SCOPE = [
  // Menus (level 1)
  'NAV_MENU_INICIO',
  'NAV_MENU_ADMIN_GLOBAL',
  'NAV_MENU_GESTION_TRABAJADORES',
  'NAV_MENU_GESTION_CONTRATOS',
  'NAV_MENU_GESTION_SUSCRIPCIONES',
  'NAV_MENU_SISTEMA',

  // Inicio
  'NAV_ITEM_INICIO_DASHBOARD',
  'NAV_ITEM_INICIO_BANDEJA_TAREAS',
  'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
  'NAV_ITEM_INICIO_INSTRUCTIVO',

  // Administraci?n global
  'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_EDIT',
  'NAV_ITEM_ADMIN_GLOBAL_CONTADORES',
  'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ',
  'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT',
  'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS',
  // Empresas (acciones / grants funcionales; no aparecen en men?)
  'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ',
  'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT',
  'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS',
  'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT',
  'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES',

  // Gesti?n trabajadores
  'NAV_ITEM_TRABAJADORES_TRABAJADORES',
  'NAV_ITEM_TRABAJADORES_HISTORIAL_DOCUMENTAL',
  'NAV_ITEM_TRABAJADORES_CARGOS',
  'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ',
  'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE',
  'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT',

  // Gesti?n contratos
  'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES',
  // Cl?usulas universales (acciones / grants funcionales; no aparecen en men?)
  'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
  'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE',
  'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT',
  'NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA',
  // Cláusulas por empresa (acciones / grants funcionales; no aparecen en menú)
  'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ',
  'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_CREATE',
  'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT',
  'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
  'NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES',
  'NAV_ITEM_CONTRATOS_PLANTILLAS',
  'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ',
  'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE',
  'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT',
  'NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA',
  'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ',
  'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE',
  'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT',
  'NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR',
  'NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA',
  'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO',
  'NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS',
  'NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS',
  'NAV_ITEM_CONTRATOS_REPORTES',
  'NAV_ITEM_CONTRATOS_EXPORTACION',
  'NAV_ITEM_CONTRATOS_IMPORTACION',

  // Gesti?n suscripciones
  'NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES',
  'NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION',
  'NAV_ITEM_SUSCRIPCIONES_FACTURACION',

  // Sistema
  'NAV_ITEM_SISTEMA_PARAMETROS',
  'NAV_ITEM_SISTEMA_AUDITORIA',
  'NAV_ITEM_SISTEMA_ROLES_PERMISOS',
  'NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA',
  'NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS'
]

// Legacy codes previously managed by this seed (kept for backward compatibility).
const LEGACY_NODE_CODES = [
  'NAV_DASHBOARD',
  'NAV_CONTRATOS',
  'NAV_PROVEEDORES',
  'NAV_CONFIGURACION',
  'NAV_GROUP_ADMINISTRACION',
  'NAV_USUARIOS',
  'NAV_REPORTES',
  'NAV_MI_PERFIL',
  'NAV_NOTIFICACIONES'
]

function id(rowOrId) {
  return typeof rowOrId === 'object' && rowOrId !== null && 'id' in rowOrId ? rowOrId.id : rowOrId
}

async function upsertNode(knex, payload) {
  const [row] = await knex('navigation_node')
    .insert(payload)
    .onConflict('code')
    .merge({
      parent_id: payload.parent_id ?? null,
      label: payload.label,
      route_path: payload.route_path ?? null,
      module_title: payload.module_title ?? null,
      sort_order: payload.sort_order,
      is_active: payload.is_active,
      show_in_main_menu: payload.show_in_main_menu
    })
    .returning('id')

  return id(row)
}

exports.seed = async function seed(knex) {
  const adminPlatform = await knex('profile').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()
  const companyAdmin = await knex('profile').where({ code: 'USUARIO_EMPRESA_ADMINISTRADOR' }).first()
  const accountant = await knex('profile').where({ code: 'CONTADOR' }).first()
  if (!adminPlatform || !companyAdmin || !accountant) {
    throw new Error(
      'profiles seed must run first (ADMINISTRADOR_PLATAFORMA, USUARIO_EMPRESA_ADMINISTRADOR, CONTADOR)'
    )
  }

  // Optional cleanup mode (rollback helper for test envs).
  if (String(process.env.NAV_SEED_CLEANUP || '').trim() === '1') {
    const nodeIds = await knex('navigation_node').select('id').whereIn('code', CODES_IN_SCOPE)
    const ids = nodeIds.map((r) => r.id)
    if (ids.length > 0) {
      await knex('profile_navigation_grant').whereIn('navigation_node_id', ids).del()
    }
    await knex('navigation_node').whereIn('code', CODES_IN_SCOPE).del()
    return
  }

  // Keep legacy nodes for backward compatibility with existing backend checks.
  // Hide them from main menu to avoid duplicates once the new NAV_MENU_/NAV_ITEM_ tree is consumed.
  const legacyDashboardId = await upsertNode(knex, {
    code: 'NAV_DASHBOARD',
    label: 'Dashboard',
    route_path: '/app/dashboard',
    module_title: 'Dashboard',
    sort_order: 100,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyContratosId = await upsertNode(knex, {
    code: 'NAV_CONTRATOS',
    label: 'Contratos',
    route_path: '/app/contratos',
    module_title: 'Contratos',
    sort_order: 200,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyProveedoresId = await upsertNode(knex, {
    code: 'NAV_PROVEEDORES',
    label: 'Proveedores',
    route_path: '/app/proveedores',
    module_title: 'Proveedores',
    sort_order: 300,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyConfigId = await upsertNode(knex, {
    code: 'NAV_CONFIGURACION',
    label: 'Configuraci?n',
    route_path: '/app/configuracion',
    module_title: 'Configuraci?n',
    sort_order: 400,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyGroupAdmId = await upsertNode(knex, {
    code: 'NAV_GROUP_ADMINISTRACION',
    label: 'Administraci?n',
    route_path: null,
    module_title: null,
    sort_order: 500,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyUsuariosId = await upsertNode(knex, {
    parent_id: legacyGroupAdmId,
    code: 'NAV_USUARIOS',
    label: 'Usuarios',
    route_path: '/app/usuarios',
    module_title: 'Usuarios',
    sort_order: 510,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyReportesId = await upsertNode(knex, {
    parent_id: legacyGroupAdmId,
    code: 'NAV_REPORTES',
    label: 'Reportes',
    route_path: '/app/reportes',
    module_title: 'Reportes',
    sort_order: 520,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyMiPerfilId = await upsertNode(knex, {
    code: 'NAV_MI_PERFIL',
    label: 'Mi perfil',
    route_path: '/app/mi-perfil',
    module_title: 'Mi perfil',
    sort_order: 900,
    is_active: true,
    show_in_main_menu: false
  })
  const legacyNotifId = await upsertNode(knex, {
    code: 'NAV_NOTIFICACIONES',
    label: 'Notificaciones',
    route_path: '/app/notificaciones',
    module_title: 'Notificaciones',
    sort_order: 910,
    is_active: true,
    show_in_main_menu: false
  })

  /**
   * Rutas privadas estables por `code` de ?tem hoja (?nico; grupos NAV_MENU_* siguen con route_path null).
   * Evitar colisiones con nodos legacy (p. ej. `/app/reportes` vs reportes de contratos bajo `/app/gestion-contratos/...`).
   */
  const ROUTE_PATH_BY_NAV_ITEM_CODE = {
    NAV_ITEM_INICIO_DASHBOARD: '/app/dashboard',
    NAV_ITEM_INICIO_BANDEJA_TAREAS: '/app/bandeja-tareas',
    NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS: '/app/alertas-y-vencimientos',
    NAV_ITEM_INICIO_INSTRUCTIVO: '/app/instructivo',

    NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA: '/app/admin-global/usuarios-plataforma',
    NAV_ITEM_ADMIN_GLOBAL_CONTADORES: '/app/admin-global/contadores',
    NAV_ITEM_ADMIN_GLOBAL_EMPRESAS: '/app/admin-global/empresas',
    NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA: '/app/admin-global/usuarios-internos-empresa',
    NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES: '/app/admin-global/jornadas-laborales',

    NAV_ITEM_TRABAJADORES_TRABAJADORES: '/app/trabajadores',
    NAV_ITEM_TRABAJADORES_HISTORIAL_DOCUMENTAL: '/app/trabajadores/historial-documental',
    NAV_ITEM_TRABAJADORES_CARGOS: '/app/trabajadores/cargos',

    NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES: '/app/gestion-contratos/clausulas-universales',
    NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA: '/app/gestion-contratos/clausulas-por-empresa',
    NAV_ITEM_CONTRATOS_CAUSALES_LEGALES: '/app/gestion-contratos/causales-legales',
    NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES: '/app/gestion-contratos/tipos-documentales',
    NAV_ITEM_CONTRATOS_PLANTILLAS: '/app/gestion-contratos/templates-estandar',
    NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA: '/app/gestion-contratos/templates-por-empresa',
    NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR: '/app/gestion-contratos/contratos-estandar',
    NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA: '/app/gestion-contratos/contratos-por-empresa',
    NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO: '/app/gestion-contratos/constructor-documento',
    NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS: '/app/gestion-contratos/repositorio-documentos',
    NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS: '/app/gestion-contratos/contratos-antiguos',
    NAV_ITEM_CONTRATOS_REPORTES: '/app/gestion-contratos/reportes',
    NAV_ITEM_CONTRATOS_EXPORTACION: '/app/gestion-contratos/exportacion',
    NAV_ITEM_CONTRATOS_IMPORTACION: '/app/gestion-contratos/importacion',

    NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES: '/app/suscripciones/tarifas-y-planes',
    NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION: '/app/suscripciones/suscripcion-renovacion',
    NAV_ITEM_SUSCRIPCIONES_FACTURACION: '/app/suscripciones/facturacion',

    NAV_ITEM_SISTEMA_PARAMETROS: '/app/sistema/parametros',
    NAV_ITEM_SISTEMA_AUDITORIA: '/app/sistema/auditoria',
    NAV_ITEM_SISTEMA_ROLES_PERMISOS: '/app/sistema/roles-y-permisos',
    NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA: '/app/sistema/eliminacion-controlada',
    NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS: '/app/sistema/configuracion-alertas'
  }
  const _navItemPaths = Object.values(ROUTE_PATH_BY_NAV_ITEM_CODE)
  if (new Set(_navItemPaths).size !== _navItemPaths.length) {
    throw new Error('ROUTE_PATH_BY_NAV_ITEM_CODE: duplicate route_path values')
  }

  // Menus level 1
  const menuInicioId = await upsertNode(knex, {
    code: 'NAV_MENU_INICIO',
    label: 'Inicio',
    route_path: null,
    module_title: null,
    sort_order: 100,
    is_active: true,
    show_in_main_menu: true
  })
  const menuAdminGlobalId = await upsertNode(knex, {
    code: 'NAV_MENU_ADMIN_GLOBAL',
    label: 'Administraci?n global',
    route_path: null,
    module_title: null,
    sort_order: 200,
    is_active: true,
    show_in_main_menu: true
  })
  const menuTrabajadoresId = await upsertNode(knex, {
    code: 'NAV_MENU_GESTION_TRABAJADORES',
    label: 'Gesti?n trabajadores',
    route_path: null,
    module_title: null,
    sort_order: 300,
    is_active: true,
    show_in_main_menu: true
  })
  const menuContratosId = await upsertNode(knex, {
    code: 'NAV_MENU_GESTION_CONTRATOS',
    label: 'Gesti?n de contratos',
    route_path: null,
    module_title: null,
    sort_order: 400,
    is_active: true,
    show_in_main_menu: true
  })
  const menuSuscripcionesId = await upsertNode(knex, {
    code: 'NAV_MENU_GESTION_SUSCRIPCIONES',
    label: 'Gesti?n de suscripciones',
    route_path: null,
    module_title: null,
    sort_order: 500,
    is_active: true,
    show_in_main_menu: true
  })
  const menuSistemaId = await upsertNode(knex, {
    code: 'NAV_MENU_SISTEMA',
    label: 'Sistema',
    route_path: null,
    module_title: null,
    sort_order: 600,
    is_active: true,
    show_in_main_menu: true
  })

  // Inicio (children)
  const navDashboardId = await upsertNode(knex, {
    parent_id: menuInicioId,
    code: 'NAV_ITEM_INICIO_DASHBOARD',
    label: 'Dashboard',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_INICIO_DASHBOARD,
    module_title: 'Dashboard',
    sort_order: 110,
    is_active: true,
    show_in_main_menu: true
  })
  const navBandejaId = await upsertNode(knex, {
    parent_id: menuInicioId,
    code: 'NAV_ITEM_INICIO_BANDEJA_TAREAS',
    label: 'Bandeja de tareas',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_INICIO_BANDEJA_TAREAS,
    module_title: 'Bandeja de tareas',
    sort_order: 120,
    is_active: true,
    show_in_main_menu: true
  })
  const navAlertasId = await upsertNode(knex, {
    parent_id: menuInicioId,
    code: 'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
    label: 'Alertas y vencimientos',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS,
    module_title: 'Alertas y vencimientos',
    sort_order: 130,
    is_active: true,
    show_in_main_menu: true
  })
  const navInstructivoId = await upsertNode(knex, {
    parent_id: menuInicioId,
    code: 'NAV_ITEM_INICIO_INSTRUCTIVO',
    label: 'Instructivo',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_INICIO_INSTRUCTIVO,
    module_title: 'Instructivo',
    sort_order: 140,
    is_active: true,
    show_in_main_menu: true
  })

  // Administraci?n global (children visibles, orden: Empresas / Usuarios plataforma / Contadores, luego demás)
  const navEmpresasId = await upsertNode(knex, {
    parent_id: menuAdminGlobalId,
    code: 'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS',
    label: 'Empresas',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_ADMIN_GLOBAL_EMPRESAS,
    module_title: 'Empresas',
    sort_order: 210,
    is_active: true,
    show_in_main_menu: true
  })

  // Empresas: acciones (no visibles en menú principal)
  await upsertNode(knex, {
    parent_id: navEmpresasId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ',
    label: 'Empresas (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 231,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navEmpresasId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_CREATE',
    label: 'Empresas (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 232,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navEmpresasId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT',
    label: 'Empresas (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 233,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navEmpresasId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS',
    label: 'Empresas (Asignar contadores)',
    route_path: null,
    module_title: null,
    sort_order: 234,
    is_active: true,
    show_in_main_menu: false
  })

  const navUsuariosPlatId = await upsertNode(knex, {
    parent_id: menuAdminGlobalId,
    code: 'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA',
    label: 'Usuarios plataforma',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA,
    module_title: 'Usuarios plataforma',
    sort_order: 220,
    is_active: true,
    show_in_main_menu: true
  })
  await upsertNode(knex, {
    parent_id: navUsuariosPlatId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ',
    label: 'Usuarios plataforma (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 211,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navUsuariosPlatId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_CREATE',
    label: 'Usuarios plataforma (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 212,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navUsuariosPlatId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_EDIT',
    label: 'Usuarios plataforma (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 213,
    is_active: true,
    show_in_main_menu: false
  })
  const navContadoresId = await upsertNode(knex, {
    parent_id: menuAdminGlobalId,
    code: 'NAV_ITEM_ADMIN_GLOBAL_CONTADORES',
    label: 'Contadores',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_ADMIN_GLOBAL_CONTADORES,
    module_title: 'Contadores',
    sort_order: 230,
    is_active: true,
    show_in_main_menu: true
  })
  await upsertNode(knex, {
    parent_id: navContadoresId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ',
    label: 'Contadores (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 221,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navContadoresId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE',
    label: 'Contadores (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 222,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navContadoresId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT',
    label: 'Contadores (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 223,
    is_active: true,
    show_in_main_menu: false
  })
  const navUsuariosIntEmpId = await upsertNode(knex, {
    parent_id: menuAdminGlobalId,
    code: 'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA',
    label: 'Usuarios internos empresa',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA,
    module_title: 'Usuarios internos empresa',
    sort_order: 240,
    is_active: true,
    show_in_main_menu: true
  })
  await upsertNode(knex, {
    parent_id: navUsuariosIntEmpId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ',
    label: 'Usuarios internos empresa (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 241,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navUsuariosIntEmpId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
    label: 'Usuarios internos empresa (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 242,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navUsuariosIntEmpId,
    code: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT',
    label: 'Usuarios internos empresa (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 243,
    is_active: true,
    show_in_main_menu: false
  })
  const navJornadasId = await upsertNode(knex, {
    parent_id: menuTrabajadoresId,
    code: 'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES',
    label: 'Jornadas laborales',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES,
    module_title: 'Jornadas laborales',
    sort_order: 340,
    is_active: true,
    show_in_main_menu: true
  })

  // Gesti?n trabajadores (children)
  const navTrabajadoresId = await upsertNode(knex, {
    parent_id: menuTrabajadoresId,
    code: 'NAV_ITEM_TRABAJADORES_TRABAJADORES',
    label: 'Trabajadores',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_TRABAJADORES_TRABAJADORES,
    module_title: 'Trabajadores',
    sort_order: 310,
    is_active: true,
    show_in_main_menu: true
  })
  await upsertNode(knex, {
    parent_id: navTrabajadoresId,
    code: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ',
    label: 'Trabajadores (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 311,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navTrabajadoresId,
    code: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE',
    label: 'Trabajadores (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 312,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navTrabajadoresId,
    code: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT',
    label: 'Trabajadores (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 313,
    is_active: true,
    show_in_main_menu: false
  })
  const navHistorialId = await upsertNode(knex, {
    parent_id: menuTrabajadoresId,
    code: 'NAV_ITEM_TRABAJADORES_HISTORIAL_DOCUMENTAL',
    label: 'Historial documental',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_TRABAJADORES_HISTORIAL_DOCUMENTAL,
    module_title: 'Historial documental',
    sort_order: 320,
    is_active: true,
    show_in_main_menu: true
  })
  const navCargosId = await upsertNode(knex, {
    parent_id: menuTrabajadoresId,
    code: 'NAV_ITEM_TRABAJADORES_CARGOS',
    label: 'Cargos',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_TRABAJADORES_CARGOS,
    module_title: 'Cargos',
    sort_order: 330,
    is_active: true,
    show_in_main_menu: true
  })

  // Gesti?n contratos (children)
  const navClaUniId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES',
    label: 'Cl?usulas universales',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES,
    module_title: 'Cl?usulas universales',
    sort_order: 410,
    is_active: true,
    show_in_main_menu: true
  })

  // Cl?usulas universales: action/grant nodes (not visible in menu)
  await upsertNode(knex, {
    parent_id: navClaUniId,
    code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
    label: 'Cl?usulas universales (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 411,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navClaUniId,
    code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE',
    label: 'Cl?usulas universales (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 412,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navClaUniId,
    code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT',
    label: 'Cl?usulas universales (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 413,
    is_active: true,
    show_in_main_menu: false
  })
  const navClaEmpId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA',
    label: 'Cl?usulas por empresa',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA,
    module_title: 'Cl?usulas por empresa',
    sort_order: 420,
    is_active: true,
    show_in_main_menu: true
  })

  // Cláusulas por empresa: action/grant nodes (not visible in menu)
  await upsertNode(knex, {
    parent_id: navClaEmpId,
    code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ',
    label: 'Cl?usulas por empresa (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 421,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navClaEmpId,
    code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_CREATE',
    label: 'Cl?usulas por empresa (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 422,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navClaEmpId,
    code: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT',
    label: 'Cl?usulas por empresa (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 423,
    is_active: true,
    show_in_main_menu: false
  })
  const navCausalesId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
    label: 'Causales legales',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CAUSALES_LEGALES,
    module_title: 'Causales legales',
    sort_order: 430,
    is_active: true,
    show_in_main_menu: true
  })
  const navTiposDocId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES',
    label: 'Tipos documentales',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES,
    module_title: 'Tipos documentales',
    sort_order: 440,
    is_active: true,
    show_in_main_menu: true
  })
  const navPlantillasId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_PLANTILLAS',
    label: 'Templates estándar',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_PLANTILLAS,
    module_title: 'Templates estándar',
    sort_order: 450,
    is_active: true,
    show_in_main_menu: true
  })
  await upsertNode(knex, {
    parent_id: navPlantillasId,
    code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ',
    label: 'Templates estándar (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 451,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navPlantillasId,
    code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE',
    label: 'Templates estándar (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 452,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navPlantillasId,
    code: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT',
    label: 'Templates estándar (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 453,
    is_active: true,
    show_in_main_menu: false
  })
  const navTemplatesEmpresaId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA',
    label: 'Templates por empresa',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA,
    module_title: 'Templates por empresa',
    sort_order: 455,
    is_active: true,
    show_in_main_menu: true
  })
  await upsertNode(knex, {
    parent_id: navTemplatesEmpresaId,
    code: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ',
    label: 'Templates por empresa (Lectura)',
    route_path: null,
    module_title: null,
    sort_order: 456,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navTemplatesEmpresaId,
    code: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE',
    label: 'Templates por empresa (Crear)',
    route_path: null,
    module_title: null,
    sort_order: 457,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navTemplatesEmpresaId,
    code: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT',
    label: 'Templates por empresa (Editar)',
    route_path: null,
    module_title: null,
    sort_order: 458,
    is_active: true,
    show_in_main_menu: false
  })
  const navContratosStdId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR',
    label: 'Contratos est?ndar',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR,
    module_title: 'Contratos est?ndar',
    sort_order: 460,
    is_active: true,
    show_in_main_menu: true
  })
  const navContratosEmpId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA',
    label: 'Contratos por empresa',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA,
    module_title: 'Contratos por empresa',
    sort_order: 470,
    is_active: true,
    show_in_main_menu: true
  })
  const navConstructorId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO',
    label: 'Constructor de documento',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO,
    module_title: 'Constructor de documento',
    sort_order: 480,
    is_active: true,
    show_in_main_menu: true
  })
  const navRepoDocsId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS',
    label: 'Repositorio de documentos',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS,
    module_title: 'Repositorio de documentos',
    sort_order: 490,
    is_active: true,
    show_in_main_menu: true
  })
  const navContratosOldId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS',
    label: 'Contratos antiguos',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS,
    module_title: 'Contratos antiguos',
    sort_order: 500,
    is_active: true,
    show_in_main_menu: true
  })
  const navReportesId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_REPORTES',
    label: 'Reportes',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_REPORTES,
    module_title: 'Reportes',
    sort_order: 510,
    is_active: true,
    show_in_main_menu: true
  })
  const navExportId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_EXPORTACION',
    label: 'Exportaci?n',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_EXPORTACION,
    module_title: 'Exportaci?n',
    sort_order: 520,
    is_active: true,
    show_in_main_menu: true
  })
  const navImportId = await upsertNode(knex, {
    parent_id: menuContratosId,
    code: 'NAV_ITEM_CONTRATOS_IMPORTACION',
    label: 'Importaci?n',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_CONTRATOS_IMPORTACION,
    module_title: 'Importaci?n',
    sort_order: 530,
    is_active: true,
    show_in_main_menu: true
  })

  // Gesti?n suscripciones (children)
  const navTarifasId = await upsertNode(knex, {
    parent_id: menuSuscripcionesId,
    code: 'NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES',
    label: 'Tarifas y planes',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES,
    module_title: 'Tarifas y planes',
    sort_order: 510,
    is_active: true,
    show_in_main_menu: true
  })
  const navSusRenId = await upsertNode(knex, {
    parent_id: menuSuscripcionesId,
    code: 'NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION',
    label: 'Suscripci?n / renovaci?n',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION,
    module_title: 'Suscripci?n / renovaci?n',
    sort_order: 520,
    is_active: true,
    show_in_main_menu: true
  })
  const navFacturacionId = await upsertNode(knex, {
    parent_id: menuSuscripcionesId,
    code: 'NAV_ITEM_SUSCRIPCIONES_FACTURACION',
    label: 'Facturaci?n',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SUSCRIPCIONES_FACTURACION,
    module_title: 'Facturaci?n',
    sort_order: 530,
    is_active: true,
    show_in_main_menu: true
  })

  // Sistema (children)
  const navParametrosId = await upsertNode(knex, {
    parent_id: menuSistemaId,
    code: 'NAV_ITEM_SISTEMA_PARAMETROS',
    label: 'Par?metros del sistema',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SISTEMA_PARAMETROS,
    module_title: 'Par?metros del sistema',
    sort_order: 610,
    is_active: true,
    show_in_main_menu: true
  })
  const navAuditoriaId = await upsertNode(knex, {
    parent_id: menuSistemaId,
    code: 'NAV_ITEM_SISTEMA_AUDITORIA',
    label: 'Auditor?a',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SISTEMA_AUDITORIA,
    module_title: 'Auditor?a',
    sort_order: 620,
    is_active: true,
    show_in_main_menu: true
  })
  const navRolesPermId = await upsertNode(knex, {
    parent_id: menuSistemaId,
    code: 'NAV_ITEM_SISTEMA_ROLES_PERMISOS',
    label: 'Roles y permisos',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SISTEMA_ROLES_PERMISOS,
    module_title: 'Roles y permisos',
    sort_order: 630,
    is_active: true,
    show_in_main_menu: true
  })
  const navElimCtrlId = await upsertNode(knex, {
    parent_id: menuSistemaId,
    code: 'NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA',
    label: 'Eliminaci?n controlada',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA,
    module_title: 'Eliminaci?n controlada',
    sort_order: 640,
    is_active: true,
    show_in_main_menu: true
  })
  const navConfigAlertasId = await upsertNode(knex, {
    parent_id: menuSistemaId,
    code: 'NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS',
    label: 'Configuraci?n alertas',
    route_path: ROUTE_PATH_BY_NAV_ITEM_CODE.NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS,
    module_title: 'Configuraci?n alertas',
    sort_order: 650,
    is_active: true,
    show_in_main_menu: true
  })

  // Build grants (grant both menu groups and allowed leaf items)
  const adminAllowed = new Set([
    // Inicio
    'NAV_MENU_INICIO',
    'NAV_ITEM_INICIO_DASHBOARD',
    'NAV_ITEM_INICIO_BANDEJA_TAREAS',
    'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
    'NAV_ITEM_INICIO_INSTRUCTIVO',
    // Legacy (compat)
    'NAV_DASHBOARD',
    'NAV_CONTRATOS',
    'NAV_PROVEEDORES',
    'NAV_CONFIGURACION',
    'NAV_USUARIOS',
    'NAV_REPORTES',
    'NAV_MI_PERFIL',
    'NAV_NOTIFICACIONES',
    // Administraci?n global
    'NAV_MENU_ADMIN_GLOBAL',
    'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_CREATE',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_EDIT',
    'NAV_ITEM_ADMIN_GLOBAL_CONTADORES',
    'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ',
    'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE',
    'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT',
    'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_CREATE',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS',
    // Jornadas laborales: solo Usuario empresa administrador y Contador (no administrador de plataforma)
    // Gesti?n de contratos (usuarios internos empresa: no grant para administrador de plataforma)
    'NAV_MENU_GESTION_CONTRATOS',
    'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT',
    'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
    'NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES',
    'NAV_ITEM_CONTRATOS_PLANTILLAS',
    'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ',
    'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE',
    'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT',
    'NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR',
    // Gesti?n de suscripciones
    'NAV_MENU_GESTION_SUSCRIPCIONES',
    'NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES',
    'NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION',
    'NAV_ITEM_SUSCRIPCIONES_FACTURACION',
    // Sistema
    'NAV_MENU_SISTEMA',
    'NAV_ITEM_SISTEMA_PARAMETROS',
    'NAV_ITEM_SISTEMA_AUDITORIA',
    'NAV_ITEM_SISTEMA_ROLES_PERMISOS'
  ])

  const companyAllowed = new Set([
    // Inicio
    'NAV_MENU_INICIO',
    'NAV_ITEM_INICIO_DASHBOARD',
    'NAV_ITEM_INICIO_BANDEJA_TAREAS',
    'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
    'NAV_ITEM_INICIO_INSTRUCTIVO',
    // Legacy (compat)
    'NAV_DASHBOARD',
    'NAV_CONTRATOS',
    'NAV_PROVEEDORES',
    'NAV_CONFIGURACION',
    'NAV_MI_PERFIL',
    'NAV_NOTIFICACIONES',
    // Administraci?n global
    'NAV_MENU_ADMIN_GLOBAL',
    'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT',
    // No usuarios plataforma: solo internos empresa (ver companyAllowed vs adminAllowed)
    'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT',
    'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES',
    // Gesti?n trabajadores
    'NAV_MENU_GESTION_TRABAJADORES',
    'NAV_ITEM_TRABAJADORES_TRABAJADORES',
    'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ',
    'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE',
    'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT',
    'NAV_ITEM_TRABAJADORES_CARGOS',
    // Gesti?n de contratos
    'NAV_MENU_GESTION_CONTRATOS',
    // Cláusulas y plantillas estándar: solo lectura (referencia para operaciones por empresa)
    'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
    'NAV_ITEM_CONTRATOS_PLANTILLAS',
    'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ',
    'NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_CREATE',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT',
    'NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA',
    'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ',
    'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE',
    'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT',
    'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
    'NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES',
    'NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA',
    'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO',
    'NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS',
    'NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS',
    'NAV_ITEM_CONTRATOS_REPORTES',
    'NAV_ITEM_CONTRATOS_EXPORTACION',
    'NAV_ITEM_CONTRATOS_IMPORTACION',
    // Gesti?n de suscripciones
    'NAV_MENU_GESTION_SUSCRIPCIONES',
    'NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION',
    'NAV_ITEM_SUSCRIPCIONES_FACTURACION',
    // Sistema
    'NAV_MENU_SISTEMA',
    'NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA',
    'NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS'
  ])

  const accountantAllowed = new Set([
    // Same as company admin but without Sistema
    // Inicio
    'NAV_MENU_INICIO',
    'NAV_ITEM_INICIO_DASHBOARD',
    'NAV_ITEM_INICIO_BANDEJA_TAREAS',
    'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
    'NAV_ITEM_INICIO_INSTRUCTIVO',
    // Legacy (compat)
    'NAV_DASHBOARD',
    'NAV_CONTRATOS',
    'NAV_PROVEEDORES',
    'NAV_CONFIGURACION',
    'NAV_MI_PERFIL',
    'NAV_NOTIFICACIONES',
    // Administraci?n global
    'NAV_MENU_ADMIN_GLOBAL',
    'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ',
    'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT',
    'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
    'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT',
    'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES',
    // Gesti?n trabajadores
    'NAV_MENU_GESTION_TRABAJADORES',
    'NAV_ITEM_TRABAJADORES_TRABAJADORES',
    'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ',
    'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE',
    'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT',
    'NAV_ITEM_TRABAJADORES_CARGOS',
    // Gesti?n de contratos
    'NAV_MENU_GESTION_CONTRATOS',
    // Cláusulas y plantillas estándar: solo lectura (referencia; paridad con USUARIO_EMPRESA_ADMINISTRADOR)
    'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
    'NAV_ITEM_CONTRATOS_PLANTILLAS',
    'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ',
    'NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_CREATE',
    'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT',
    'NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA',
    'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ',
    'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE',
    'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT',
    'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
    'NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES',
    'NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA',
    'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO',
    'NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS',
    'NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS',
    'NAV_ITEM_CONTRATOS_REPORTES',
    'NAV_ITEM_CONTRATOS_EXPORTACION',
    'NAV_ITEM_CONTRATOS_IMPORTACION',
    // Gesti?n de suscripciones
    'NAV_MENU_GESTION_SUSCRIPCIONES',
    'NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION',
    'NAV_ITEM_SUSCRIPCIONES_FACTURACION'
  ])

  const nodes = await knex('navigation_node')
    .select('id', 'code')
    .whereIn('code', [...CODES_IN_SCOPE, ...LEGACY_NODE_CODES])
  const idByCode = new Map(nodes.map((r) => [r.code, r.id]))
  const nodeIdsInScope = nodes.map((r) => r.id)

  // Replace grants for these profiles within our scope.
  await knex('profile_navigation_grant')
    .whereIn('profile_id', [adminPlatform.id, companyAdmin.id, accountant.id])
    .whereIn('navigation_node_id', nodeIdsInScope)
    .del()

  const mkGrants = (profileId, allowedSet) =>
    Array.from(allowedSet).map((code) => ({
      profile_id: profileId,
      navigation_node_id: idByCode.get(code)
    }))

  const grants = [
    ...mkGrants(adminPlatform.id, adminAllowed),
    ...mkGrants(companyAdmin.id, companyAllowed),
    ...mkGrants(accountant.id, accountantAllowed)
  ].filter((g) => Boolean(g.navigation_node_id))

  await knex('profile_navigation_grant')
    .insert(grants)
    .onConflict(['profile_id', 'navigation_node_id'])
    .ignore()
}
