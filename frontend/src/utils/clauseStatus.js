export function mapClauseStatusToSpanish(status) {
  const v = typeof status === 'string' ? status.trim().toLowerCase() : ''
  if (!v) return '—'
  if (v === 'draft') return 'Borrador'
  if (v === 'active') return 'Activa'
  if (v === 'inactive') return 'Inactiva'
  return '—'
}

