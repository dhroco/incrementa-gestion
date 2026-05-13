import { useDispatch, useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import {
  selectEnrichmentStatus,
  selectSession,
  signOutThunk
} from '../store/authSlice'
import { AuthLoadingScreen } from '../routes/AuthLoadingScreen'
import './NoProfilePage.css'

export function NoProfilePage() {
  const dispatch = useDispatch()
  const session = useSelector(selectSession)
  const status = useSelector(selectEnrichmentStatus)

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (status === 'idle' || status === 'loading') {
    return <AuthLoadingScreen />
  }

  if (status === 'succeeded') {
    return <Navigate to="/app/dashboard" replace />
  }

  if (status === 'failed') {
    return <Navigate to="/app/dashboard" replace />
  }

  return (
    <div className="no-profile-page">
      <div className="no-profile-page__card">
        <h1 className="no-profile-page__title">Sin perfil asignado</h1>
        <p className="no-profile-page__text">
          Su cuenta no tiene un perfil interno asignado. Contacte al administrador del sistema para solicitar
          acceso.
        </p>
        <button type="button" className="btn" onClick={() => dispatch(signOutThunk())}>
          Salir
        </button>
      </div>
    </div>
  )
}
