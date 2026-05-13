/**
 * Resolución de ícono del sidebar:
 * 1) `nav.code` → ICON_KEY_BY_NAV_CODE (preferido; alineado con seeds `navigation_node.code`)
 * 2) `nav.routePath` normalizado → ICON_KEY_BY_ROUTE (legacy y rutas sin mapeo por código)
 * 3) Fallback
 */
import { normalizeRoutePath } from './authorizationSelectors'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
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
  inbox: { name: 'inbox', Component: wrapMuiIcon(InboxOutlinedIcon) },
  notifications: { name: 'notifications', Component: wrapMuiIcon(NotificationsOutlinedIcon) },
  menu_book: { name: 'menu_book', Component: wrapMuiIcon(MenuBookOutlinedIcon) },
  manage_accounts: { name: 'manage_accounts', Component: wrapMuiIcon(ManageAccountsOutlinedIcon) },
  badge: { name: 'badge', Component: wrapMuiIcon(BadgeOutlinedIcon) },
  business: { name: 'business', Component: wrapMuiIcon(BusinessOutlinedIcon) },
  groups: { name: 'groups', Component: wrapMuiIcon(GroupsOutlinedIcon) },
  schedule: { name: 'schedule', Component: wrapMuiIcon(ScheduleOutlinedIcon) },
  engineering: { name: 'engineering', Component: wrapMuiIcon(EngineeringOutlinedIcon) },
  history: { name: 'history', Component: wrapMuiIcon(HistoryOutlinedIcon) },
  work: { name: 'work', Component: wrapMuiIcon(WorkOutlineOutlinedIcon) },
  gavel: { name: 'gavel', Component: wrapMuiIcon(GavelOutlinedIcon) },
  balance: { name: 'balance', Component: wrapMuiIcon(BalanceOutlinedIcon) },
  description: { name: 'description', Component: wrapMuiIcon(DescriptionOutlinedIcon) },
  library_books: { name: 'library_books', Component: wrapMuiIcon(LibraryBooksOutlinedIcon) },
  article: { name: 'article', Component: wrapMuiIcon(ArticleOutlinedIcon) },
  build: { name: 'build', Component: wrapMuiIcon(BuildOutlinedIcon) },
  folder: { name: 'folder', Component: wrapMuiIcon(FolderOutlinedIcon) },
  upload_file: { name: 'upload_file', Component: wrapMuiIcon(UploadFileOutlinedIcon) },
  analytics: { name: 'analytics', Component: wrapMuiIcon(AnalyticsOutlinedIcon) },
  download: { name: 'download', Component: wrapMuiIcon(DownloadOutlinedIcon) },
  upload: { name: 'upload', Component: wrapMuiIcon(UploadOutlinedIcon) },
  payments: { name: 'payments', Component: wrapMuiIcon(PaymentsOutlinedIcon) },
  autorenew: { name: 'autorenew', Component: wrapMuiIcon(AutorenewOutlinedIcon) },
  receipt_long: { name: 'receipt_long', Component: wrapMuiIcon(ReceiptLongOutlinedIcon) },
  settings: { name: 'settings', Component: wrapMuiIcon(SettingsOutlinedIcon) },
  fact_check: { name: 'fact_check', Component: wrapMuiIcon(FactCheckOutlinedIcon) },
  lock: { name: 'lock', Component: wrapMuiIcon(LockOutlinedIcon) },
  delete_forever: { name: 'delete_forever', Component: wrapMuiIcon(DeleteForeverOutlinedIcon) },
  tune: { name: 'tune', Component: wrapMuiIcon(TuneOutlinedIcon) },
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
  NAV_ITEM_INICIO_BANDEJA_TAREAS: 'inbox',
  NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS: 'notifications',
  NAV_ITEM_INICIO_INSTRUCTIVO: 'menu_book',

  // Administración global
  NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA: 'manage_accounts',
  NAV_ITEM_ADMIN_GLOBAL_CONTADORES: 'badge',
  NAV_ITEM_ADMIN_GLOBAL_EMPRESAS: 'business',
  NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA: 'groups',
  NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES: 'schedule',

  // Gestión trabajadores
  NAV_ITEM_TRABAJADORES_TRABAJADORES: 'engineering',
  NAV_ITEM_TRABAJADORES_HISTORIAL_DOCUMENTAL: 'history',
  NAV_ITEM_TRABAJADORES_CARGOS: 'work',

  // Gestión contratos
  NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES: 'gavel',
  NAV_ITEM_CONTRATOS_CLAUSULAS_POR_EMPRESA: 'gavel',
  NAV_ITEM_CONTRATOS_CAUSALES_LEGALES: 'balance',
  NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES: 'description',
  NAV_ITEM_CONTRATOS_PLANTILLAS: 'library_books',
  NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA: 'library_books',
  NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR: 'article',
  NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA: 'article',
  NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO: 'build',
  NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS: 'folder',
  NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS: 'upload_file',
  NAV_ITEM_CONTRATOS_REPORTES: 'analytics',
  NAV_ITEM_CONTRATOS_EXPORTACION: 'download',
  NAV_ITEM_CONTRATOS_IMPORTACION: 'upload',

  // Gestión suscripciones
  NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES: 'payments',
  NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION: 'autorenew',
  NAV_ITEM_SUSCRIPCIONES_FACTURACION: 'receipt_long',

  // Sistema
  NAV_ITEM_SISTEMA_PARAMETROS: 'settings',
  NAV_ITEM_SISTEMA_AUDITORIA: 'fact_check',
  NAV_ITEM_SISTEMA_ROLES_PERMISOS: 'lock',
  NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA: 'delete_forever',
  NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS: 'tune',

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
  '/app/admin-global/contadores': 'badge',
  '/app/admin-global/usuarios-plataforma': 'manage_accounts',
  '/app/admin-global/usuarios-internos-empresa': 'groups',
  '/app/gestion-contratos/clausulas-universales': 'gavel',
  '/app/gestion-contratos/clausulas-por-empresa': 'gavel',
  '/app/gestion-contratos/templates-estandar': 'library_books',
  '/app/gestion-contratos/templates-por-empresa': 'library_books'
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
