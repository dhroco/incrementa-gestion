import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectEnrichedNavigation, selectEnrichmentStatus } from '../store/authSlice'
import { decidePrivateNavigation } from './profileNavGuardDecision'

/**
 * Enforces private navigation using effective backend-provided authorization.
 */
export function ProfileNavGuard() {
  const location = useLocation()
  const navigation = useSelector(selectEnrichedNavigation)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const routes = navigation?.routes
  const decision = decidePrivateNavigation({
    pathname: location.pathname,
    enrichmentStatus,
    routes
  })

  if (decision.type === 'redirect') {
    return <Navigate to={decision.to} replace state={{ from: location }} />
  }

  return <Outlet />
}
