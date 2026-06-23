import { useAbility } from '@casl/react'
import { Navigate } from 'react-router-dom'
import { selectEnrichmentStatus } from '../store/authSlice'
import { useSelector } from 'react-redux'
import { AbilityContext } from '../lib/ability'

/**
 * Renders children only if the CASL ability grants action on subject.
 */
export function RequireCan({ I: action, a: subjectName, children, fallbackTo = '/app/acceso-denegado' }) {
  const ability = useAbility(AbilityContext)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)

  if (enrichmentStatus === 'loading') {
    return <div style={{ fontSize: '13px', padding: '16px', color: '#000' }}>Cargando…</div>
  }

  if (!ability.can(action, subjectName)) {
    return <Navigate to={fallbackTo} replace />
  }

  return children
}

/**
 * Grants access if any of the listed actions is allowed on subject.
 */
export function RequireCanAny({ actions, a: subjectName, children, fallbackTo = '/app/acceso-denegado' }) {
  const ability = useAbility(AbilityContext)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)

  if (enrichmentStatus === 'loading') {
    return <div style={{ fontSize: '13px', padding: '16px', color: '#000' }}>Cargando…</div>
  }

  const list = Array.isArray(actions) ? actions : []
  const allowed = list.some((action) => ability.can(action, subjectName))
  if (!allowed) {
    return <Navigate to={fallbackTo} replace />
  }

  return children
}
