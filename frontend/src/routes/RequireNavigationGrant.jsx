import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectEnrichedNavigation, selectEnrichmentStatus } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'

/**
 * Renders children only if the session grants `navigationCode`, or one of `anyOfCodes` when set.
 */
export function RequireNavigationGrant({ navigationCode, anyOfCodes, children, fallbackTo = '/app/acceso-denegado' }) {
  const navigation = useSelector(selectEnrichedNavigation)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])

  if (enrichmentStatus === 'loading') {
    return <div style={{ fontSize: '13px', padding: '16px', color: '#000' }}>Cargando…</div>
  }

  const hasAny =
    Array.isArray(anyOfCodes) && anyOfCodes.length > 0
      ? anyOfCodes.some((c) => typeof c === 'string' && c && grantedCodes.has(c))
      : typeof navigationCode === 'string' && navigationCode && grantedCodes.has(navigationCode)

  if (!hasAny) {
    return <Navigate to={fallbackTo} replace />
  }

  return children
}
