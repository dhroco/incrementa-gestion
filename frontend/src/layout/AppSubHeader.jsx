import { useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { getModuleTitleFromMenuConfig, resolveMenuMatchForPathname } from '../navigation/menuConfig'
import { getSidebarIconForNavItem } from '../navigation/sidebarIconography.jsx'
import { selectEnrichmentStatus } from '../store/authSlice'
import { useShell } from './useShell'
import { fixSpanishMojibake } from '../utils/fixMojibake'

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
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const {
    sidebarCollapsed,
    expandSidebar,
    subHeaderActions,
    subHeaderTitle,
    subHeaderBreadcrumb
  } = useShell()
  const navMatch =
    enrichmentStatus === 'succeeded' ? resolveMenuMatchForPathname(pathname) : null
  const navIcon = getSidebarIconForNavItem({
    code: navMatch?.code ?? null,
    routePath: navMatch?.routePath ?? pathname
  })

  const rawFallbackTitle = subHeaderTitle
    ? subHeaderTitle
    : enrichmentStatus === 'succeeded'
      ? getModuleTitleFromMenuConfig(pathname) || 'Módulo'
      : 'Módulo'
  const fallbackTitle = fixSpanishMojibake(rawFallbackTitle)

  const hasTools = Boolean(subHeaderActions)
  const showAfterIdentitySep = hasTools

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
    </div>
  )
}
