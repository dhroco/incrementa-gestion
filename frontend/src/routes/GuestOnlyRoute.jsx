import { useIsAuthenticated } from '@azure/msal-react'
import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import { selectAuthInitialized, selectEnrichmentStatus } from '../store/authSlice'
import { DEFAULT_PRIVATE_PATH } from '../navigation/menuConfig'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function GuestOnlyRoute({ children }) {
  const initialized = useSelector(selectAuthInitialized)
  const isAuthenticated = useIsAuthenticated()
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
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
      return <Navigate to={DEFAULT_PRIVATE_PATH} replace />
    }
    const fromPath = location.state?.from?.pathname
    const candidate =
      typeof fromPath === 'string' && fromPath.startsWith('/app') && fromPath !== '/login'
        ? fromPath
        : DEFAULT_PRIVATE_PATH
    return <Navigate to={candidate} replace />
  }

  return children
}
