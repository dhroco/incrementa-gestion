import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import {
  buildAllowedPathSet,
  getDefaultPrivatePathFromRoutes
} from '../navigation/authorizationSelectors'
import {
  selectAuthInitialized,
  selectEnrichedNavigation,
  selectEnrichmentStatus,
  selectIsAuthenticated
} from '../store/authSlice'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function GuestOnlyRoute({ children }) {
  const initialized = useSelector(selectAuthInitialized)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const navigation = useSelector(selectEnrichedNavigation)
  const location = useLocation()

  if (!initialized) {
    return <AuthLoadingScreen />
  }

  if (isAuthenticated) {
    if (enrichmentStatus === 'idle' || enrichmentStatus === 'loading') {
      return <AuthLoadingScreen />
    }
    if (enrichmentStatus === 'missing_profile') {
      return <Navigate to="/sin-perfil" replace />
    }
    if (enrichmentStatus === 'empty_navigation') {
      return <Navigate to="/app" replace />
    }
    if (enrichmentStatus === 'failed') {
      return <Navigate to="/app/dashboard" replace />
    }
    const routes = navigation?.routes
    const defaultPrivate =
      routes && routes.length > 0
        ? getDefaultPrivatePathFromRoutes(routes) || '/app/dashboard'
        : '/app/dashboard'
    const fromPath = location.state?.from?.pathname
    const candidate =
      typeof fromPath === 'string' && fromPath.startsWith('/app') && fromPath !== '/login'
        ? fromPath
        : defaultPrivate
    const allowed = routes && routes.length > 0 ? buildAllowedPathSet(routes) : null
    const normalized = candidate.replace(/\/$/, '') || '/'
    const target =
      allowed && allowed.size > 0 && !allowed.has(normalized) ? defaultPrivate : candidate
    return <Navigate to={target} replace />
  }

  return children
}
