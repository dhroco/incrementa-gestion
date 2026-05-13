import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuthInitialized, selectIsAuthenticated } from '../store/authSlice'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function RequireAuth() {
  const initialized = useSelector(selectAuthInitialized)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const location = useLocation()

  if (!initialized) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
