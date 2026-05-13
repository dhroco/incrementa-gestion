import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import {
  getModuleTitleFromAuthorizationRoutes,
  resolveNavRouteMatchForPathname
} from '../navigation/authorizationSelectors'
import { getSidebarIconForNavItem } from '../navigation/sidebarIconography.jsx'
import {
  selectEnrichedCompany,
  selectEnrichedNavigation,
  selectEnrichedProfile,
  selectEnrichmentStatus,
  selectUser
} from '../store/authSlice'
import { selectAssignedCompanies, selectSelectedCompanyId, setSelectedCompanyId } from '../store/sessionCompanySlice'
import { useShell } from './useShell'
import { fixSpanishMojibake } from '../utils/fixMojibake'

function AccountantCompanySelect() {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const assigned = useSelector(selectAssignedCompanies)
  const selectedId = useSelector(selectSelectedCompanyId)
  const userId = user?.id ?? null

  if (!assigned.length) {
    return (
      <div className="app-subheader__trail-text">
        Empresa: <strong>—</strong>
      </div>
    )
  }

  return (
    <label className="app-subheader__trail-select-label">
      <span>Empresa</span>
      <select
        className="app-subheader__company-select"
        aria-label="Empresa de trabajo"
        value={selectedId ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (userId && v) {
            dispatch(setSelectedCompanyId({ userId, companyId: v }))
          }
        }}
      >
        {assigned.map((c) => (
          <option key={c.id} value={c.id}>
            {c.business_name && String(c.business_name).trim().length > 0 ? c.business_name : c.id}
          </option>
        ))}
      </select>
    </label>
  )
}

function SubheaderIdentity({ breadcrumb, fallbackTitle }) {
  if (breadcrumb && breadcrumb.length > 0) {
    return (
      <div className="app-subheader__identity-text app-subheader__identity-text--breadcrumb" translate="no">
        {breadcrumb.map((seg, i) => (
          <span key={`${i}-${seg.label}`} className="app-subheader__crumb">
            {i > 0 ? <span className="app-subheader__crumb-slash">/</span> : null}
            {seg.to ? (
              <Link className="app-subheader__crumb-link" to={seg.to}>
                {fixSpanishMojibake(seg.label)}
              </Link>
            ) : (
              <span className="app-subheader__crumb-label">{fixSpanishMojibake(seg.label)}</span>
            )}
          </span>
        ))}
      </div>
    )
  }

  return (
    <h1 className="app-subheader__title" translate="no">
      {fallbackTitle}
    </h1>
  )
}

export function AppSubHeader() {
  const { pathname } = useLocation()
  const navigation = useSelector(selectEnrichedNavigation)
  const profile = useSelector(selectEnrichedProfile)
  const company = useSelector(selectEnrichedCompany)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const {
    sidebarCollapsed,
    expandSidebar,
    subHeaderActions,
    subHeaderTitle,
    subHeaderBreadcrumb
  } = useShell()
  const routes = navigation?.routes
  const navMatch =
    enrichmentStatus === 'succeeded' && routes?.length ? resolveNavRouteMatchForPathname(pathname, routes) : null
  const navIcon = getSidebarIconForNavItem({ code: navMatch?.code ?? null, routePath: navMatch?.routePath ?? null })

  const rawFallbackTitle = subHeaderTitle
    ? subHeaderTitle
    : enrichmentStatus === 'succeeded' && routes?.length
      ? getModuleTitleFromAuthorizationRoutes(pathname, routes)
      : 'Módulo'
  const fallbackTitle = fixSpanishMojibake(rawFallbackTitle)

  const isCompanyAdmin = profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR'
  const isAccountant = profile?.code === 'CONTADOR'
  const companyName =
    isCompanyAdmin && typeof company?.business_name === 'string' && company.business_name.trim().length
      ? company.business_name
      : null

  const hasTools = Boolean(subHeaderActions)
  const hasProfileTrail = isAccountant || isCompanyAdmin
  const showAfterIdentitySep = hasTools || hasProfileTrail

  return (
    <div className="app-subheader">
      <div className="app-subheader__left">
        {sidebarCollapsed ? (
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Abrir menú lateral"
            onClick={expandSidebar}
          >
            <span className="hamburger-btn__icon" aria-hidden="true" />
          </button>
        ) : null}
        <span className="app-subheader__nav-icon" aria-hidden="true">
          <navIcon.Component />
        </span>
        <SubheaderIdentity breadcrumb={subHeaderBreadcrumb} fallbackTitle={fallbackTitle} />
      </div>
      {showAfterIdentitySep ? <div className="app-subheader__rule" role="separator" aria-hidden="true" /> : null}
      <div
        className={`app-subheader__tools${hasTools ? '' : ' app-subheader__tools--empty'}`}
        data-has-tools={hasTools ? 'true' : 'false'}
      >
        {hasTools ? <div className="app-subheader__tools-inner">{subHeaderActions}</div> : null}
      </div>
      {hasProfileTrail ? <div className="app-subheader__rule" role="separator" aria-hidden="true" /> : null}
      {hasProfileTrail ? (
        <div className="app-subheader__trail">
          {isAccountant ? <AccountantCompanySelect /> : null}
          {isCompanyAdmin ? (
            <div className="app-subheader__trail-text">
              Empresa: <strong>{companyName ?? '—'}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
