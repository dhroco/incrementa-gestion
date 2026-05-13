/**
 * @param {string | Date | null | undefined} isoOrDate
 * @returns {string}
 */
export function formatAuditDateTime(isoOrDate) {
  if (!isoOrDate) return '—'
  const d = typeof isoOrDate === 'string' || typeof isoOrDate === 'number' ? new Date(isoOrDate) : isoOrDate
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })
}

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} idFallback
 * @returns {string}
 */
export function auditPersonLabel(name, idFallback) {
  if (name != null && String(name).trim()) return String(name).trim()
  if (idFallback != null && String(idFallback).trim()) return `Perfil ${String(idFallback).slice(0, 8)}…`
  return '—'
}

/**
 * Texto para columna "Último editor" en listados (plantillas, cláusulas).
 * Alineado con ficha Ver: `last_editor_display` del backend, luego nombre o "Perfil …" por `user_profile.id`.
 *
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
export function listRowLastEditorLabel(row) {
  if (!row || typeof row !== 'object') return '—'
  const disp = row.last_editor_display != null ? String(row.last_editor_display).trim() : ''
  if (disp) return disp
  const byLastEdit = auditPersonLabel(row.last_edited_by_name, row.last_edited_by)
  if (byLastEdit !== '—') return byLastEdit
  return auditPersonLabel(row.updated_by_name, row.updated_by)
}
