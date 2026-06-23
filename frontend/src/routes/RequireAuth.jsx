import { useIsAuthenticated } from '@azure/msal-react'
import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuthInitialized } from '../store/authSlice'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function RequireAuth() {
  const initialized = useSelector(selectAuthInitialized)
  const isAuthenticated = useIsAuthenticated()
  const location = useLocation()

  if (!initialized) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
