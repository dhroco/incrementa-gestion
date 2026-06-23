/**

 * Resolución de ícono del sidebar:

 * 1) `nav.code` → ICON_KEY_BY_NAV_CODE (preferido; alineado con seeds `navigation_node.code`)

 * 2) `nav.routePath` normalizado → ICON_KEY_BY_ROUTE (legacy y rutas sin mapeo por código)

 * 3) Fallback

 */

import { normalizeRoutePath } from './authorizationSelectors'

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'

import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'

import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'

import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'

import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'

import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'

import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined'

import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'

import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'

import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'

import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'

import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'

import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'

import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'

import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'

import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'

import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'



function wrapMuiIcon(MuiIcon) {

  const IconComp = MuiIcon

  function Wrapped() {

    return <IconComp sx={{ fontSize: 16 }} />

  }

  return Wrapped

}



/** @type {Record<string, { name: string, Component: React.ComponentType<any> }>} */

const ICONS_BY_NAME = {

  dashboard: { name: 'dashboard', Component: wrapMuiIcon(DashboardOutlinedIcon) },

  notifications: { name: 'notifications', Component: wrapMuiIcon(NotificationsOutlinedIcon) },

  manage_accounts: { name: 'manage_accounts', Component: wrapMuiIcon(ManageAccountsOutlinedIcon) },

  badge: { name: 'badge', Component: wrapMuiIcon(BadgeOutlinedIcon) },

  business: { name: 'business', Component: wrapMuiIcon(BusinessOutlinedIcon) },

  schedule: { name: 'schedule', Component: wrapMuiIcon(ScheduleOutlinedIcon) },

  engineering: { name: 'engineering', Component: wrapMuiIcon(EngineeringOutlinedIcon) },

  history: { name: 'history', Component: wrapMuiIcon(HistoryOutlinedIcon) },

  work: { name: 'work', Component: wrapMuiIcon(WorkOutlineOutlinedIcon) },

  gavel: { name: 'gavel', Component: wrapMuiIcon(GavelOutlinedIcon) },

  description: { name: 'description', Component: wrapMuiIcon(DescriptionOutlinedIcon) },

  library_books: { name: 'library_books', Component: wrapMuiIcon(LibraryBooksOutlinedIcon) },

  article: { name: 'article', Component: wrapMuiIcon(ArticleOutlinedIcon) },

  build: { name: 'build', Component: wrapMuiIcon(BuildOutlinedIcon) },

  draw: { name: 'draw', Component: wrapMuiIcon(DrawOutlinedIcon) },

  analytics: { name: 'analytics', Component: wrapMuiIcon(AnalyticsOutlinedIcon) },

  settings: { name: 'settings', Component: wrapMuiIcon(SettingsOutlinedIcon) },

  lock: { name: 'lock', Component: wrapMuiIcon(LockOutlinedIcon) },

  handshake: { name: 'handshake', Component: wrapMuiIcon(HandshakeOutlinedIcon) },

  storefront: { name: 'storefront', Component: wrapMuiIcon(StorefrontOutlinedIcon) },

  person: { name: 'person', Component: wrapMuiIcon(PersonOutlineOutlinedIcon) },

  fallback: { name: 'fallback', Component: wrapMuiIcon(HelpOutlineOutlinedIcon) }

}



function pickIcon(iconKey) {

  const k = String(iconKey || '')

  return ICONS_BY_NAME[k] || ICONS_BY_NAME.fallback

}



/**

 * Stable mapping from backend navigation_node.code → Material-style icon key (user-provided).

 * See backend/seeds/002_navigation_authorization_seed.js

 */

const ICON_KEY_BY_NAV_CODE = {

  // Inicio

  NAV_ITEM_INICIO_DASHBOARD: 'dashboard',



  // Administración global

  NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA: 'manage_accounts',

  NAV_ITEM_ADMIN_GLOBAL_EMPRESAS: 'business',

  NAV_ITEM_PROVEEDORES_PROVEEDORES: 'handshake',

  NAV_ITEM_ADMIN_GLOBAL_CLIENTES: 'storefront',



  // Gestión contratos

  NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES: 'description',

  NAV_ITEM_CONTRATOS_PLANTILLAS: 'library_books',

  NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO: 'build',

  NAV_ITEM_CONTRATOS_CONSULTA: 'description',

  NAV_ITEM_CONTRATOS_FIRMA: 'draw',



  // Sistema

  NAV_ITEM_SISTEMA_ROLES_PERMISOS: 'lock',



  // Legacy nodes (hidden from main menu in seed, still used in routes/API)

  NAV_DASHBOARD: 'dashboard',

  NAV_CONTRATOS: 'article',

  NAV_PROVEEDORES: 'business',

  NAV_CONFIGURACION: 'settings',

  NAV_USUARIOS: 'manage_accounts',

  NAV_REPORTES: 'analytics',

  NAV_MI_PERFIL: 'person',

  NAV_NOTIFICACIONES: 'notifications'

}



/**

 * Fallback when only routePath is known (legacy URLs or future routes).

 * @type {Record<string, string>}

 */

const ICON_KEY_BY_ROUTE = {

  '/app/dashboard': 'dashboard',

  '/app/contratos': 'article',

  '/app/proveedores': 'business',

  '/app/configuracion': 'settings',

  '/app/usuarios': 'manage_accounts',

  '/app/reportes': 'analytics',

  '/app/mi-perfil': 'person',

  '/app/notificaciones': 'notifications',

  '/app/admin-global/empresas': 'business',

  '/app/admin-global/usuarios-plataforma': 'manage_accounts',

  '/app/admin-global/clientes': 'storefront',

  '/app/gestion-contratos/templates-estandar': 'library_books',

  '/app/gestion-contratos/consulta-contratos': 'description',

  '/app/gestion-contratos/firma-documento': 'draw'

}



/**

 * @param {{ code?: string | null, routePath?: string | null }} nav

 * @returns {{ name: string, Component: React.ComponentType<any> }}

 */

export function getSidebarIconForNavItem(nav) {

  const code = typeof nav?.code === 'string' ? nav.code : null

  if (code && ICON_KEY_BY_NAV_CODE[code]) {

    return pickIcon(ICON_KEY_BY_NAV_CODE[code])

  }



  const routePath = typeof nav?.routePath === 'string' ? normalizeRoutePath(nav.routePath) : null

  if (routePath && ICON_KEY_BY_ROUTE[routePath]) {

    return pickIcon(ICON_KEY_BY_ROUTE[routePath])

  }



  return pickIcon('fallback')

}


