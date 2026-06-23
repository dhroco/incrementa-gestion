import { Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  selectEnrichedIsActive,
  selectEnrichmentStatus
} from '../store/authSlice'

/**
 * Enforces authenticated shell access after session enrichment.
 */
export function ProfileNavGuard() {
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const enrichedIsActive = useSelector(selectEnrichedIsActive)

  if (enrichmentStatus === 'loading' || enrichmentStatus === 'idle') {
    return <div style={{ fontSize: '13px', padding: '16px', color: '#000' }}>Cargando…</div>
  }

  if (enrichedIsActive === false) {
    return <Navigate to="/app/acceso-denegado" replace />
  }

  if (enrichmentStatus !== 'succeeded' && enrichmentStatus !== 'empty_navigation') {
    return <Outlet />
  }

  return <Outlet />
}
