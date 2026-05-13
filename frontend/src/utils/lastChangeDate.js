export function formatLastChangeDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-CL', { dateStyle: 'short' })
  } catch {
    return '—'
  }
}

