import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  fetchEnrichedSessionThunk,
  selectEnrichmentError,
  selectEnrichmentStatus,
  selectMustChangePassword,
  selectSession,
  signOutThunk
} from '../store/authSlice'
import { MSG_NAV_MENU_EMPTY } from '../navigation/navigationMessages'
import { AuthLoadingScreen } from './AuthLoadingScreen'

function normalizePath(p) {
  return (p || '/').replace(/\/$/, '') || '/'
}

export function PrivateAppGate() {
  const dispatch = useDispatch()
  const location = useLocation()
  const session = useSelector(selectSession)
  const status = useSelector(selectEnrichmentStatus)
  const error = useSelector(selectEnrichmentError)
  const mustChangePassword = useSelector(selectMustChangePassword)

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (status === 'idle' || status === 'loading') {
    return <AuthLoadingScreen />
  }

  if (status === 'missing_profile') {
    return <Navigate to="/sin-perfil" replace />
  }

  if (status === 'failed') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: 'var(--color-work-area)',
          fontFamily: 'var(--font-family-base)',
          fontSize: '13px',
          color: 'var(--color-text-dark)',
          padding: '24px',
          textAlign: 'center'
        }}
      >
        <p style={{ maxWidth: '420px', margin: 0 }}>{error || 'No se pudo cargar la sesión de la aplicación.'}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => dispatch(fetchEnrichedSessionThunk())}>
            Reintentar
          </button>
          <button type="button" className="btn" onClick={() => dispatch(signOutThunk())}>
            Salir
          </button>
        </div>
      </div>
    )
  }

  if (status === 'accountant_inactive') {
    const p = normalizePath(location.pathname)
    if (p !== '/app/cuenta-inactiva') {
      return <Navigate to="/app/cuenta-inactiva" replace />
    }
    return <Outlet />
  }

  if (status === 'succeeded' && mustChangePassword) {
    const p = normalizePath(location.pathname)
    if (p !== '/app/cambiar-clave') {
      return <Navigate to="/app/cambiar-clave" replace />
    }
    return <Outlet />
  }

  if (status === 'empty_navigation') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: 'var(--color-work-area)',
          fontFamily: 'var(--font-family-base)',
          fontSize: '13px',
          color: 'var(--color-text-dark)',
          padding: '24px',
          textAlign: 'center'
        }}
      >
        <p style={{ maxWidth: '420px', margin: 0 }}>{MSG_NAV_MENU_EMPTY}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => dispatch(fetchEnrichedSessionThunk())}>
            Reintentar
          </button>
          <button type="button" className="btn" onClick={() => dispatch(signOutThunk())}>
            Salir
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
