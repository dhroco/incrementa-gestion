import '../placeholder/placeholder.css'
import { useSubHeaderActions } from '../layout/useSubHeaderActions'
import { useSubHeaderBreadcrumb } from '../layout/useSubHeaderBreadcrumb'
import { useSubHeaderTitle } from '../layout/useSubHeaderTitle'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { getModuleTitleFromAuthorizationRoutes } from '../navigation/authorizationSelectors'
import { selectEnrichedNavigation, selectEnrichmentStatus } from '../store/authSlice'
import { fixSpanishMojibake } from '../utils/fixMojibake'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Consistent inner page layout inside authenticated shell.
 * Title/subtitle live in content area; actions live in the shell sub-header (via hook).
 * @param {import('react').ReactNode} [localToolbar] — fila superior izquierda, justo debajo del subheader del shell (antes del título de página).
 */
export function PageShell({
  title,
  subtitle,
  actions,
  breadcrumb,
  localToolbar,
  className,
  subHeaderTitle,
  hideHeader = false,
  children
}) {
  const hasBreadcrumb = Array.isArray(breadcrumb) && breadcrumb.length > 0
  useSubHeaderBreadcrumb(hasBreadcrumb ? breadcrumb : null)
  useSubHeaderTitle(hasBreadcrumb ? null : subHeaderTitle ?? null)
  useSubHeaderActions(actions ?? null)

  const { pathname } = useLocation()
  const navigation = useSelector(selectEnrichedNavigation)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const routes = navigation?.routes

  const titleFromRoutes =
    enrichmentStatus === 'succeeded' && routes?.length ? getModuleTitleFromAuthorizationRoutes(pathname, routes) : null

  const safeTitle = fixSpanishMojibake(
    isNonEmptyString(title) ? title : isNonEmptyString(titleFromRoutes) ? titleFromRoutes : 'Módulo'
  )
  const safeSubtitle = isNonEmptyString(subtitle) ? fixSpanishMojibake(subtitle) : null

  return (
    <div className={`ph-page${typeof className === 'string' && className.trim().length ? ` ${className}` : ''}`}>
      {localToolbar ? <div className="ph-local-toolbar">{localToolbar}</div> : null}
      {!hideHeader ? (
        <div className="ph-header">
          <div className="ph-title">{safeTitle}</div>
          {safeSubtitle ? <div className="ph-subtitle">{safeSubtitle}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

