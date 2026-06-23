/**
 * Valida y normaliza a `YYYY-MM-DD` (para `<input type="date">` o API).
 * @param {string | null | undefined} s
 * @returns {string | null}
 */
export function normalizeIsoDateOrNull(s) {
  if (s == null) return null
  const t = String(s).trim()
  if (!t) return null
  const dayPart = t.length >= 10 ? t.slice(0, 10) : t
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayPart)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/**
 * Auto-formatea texto a dd/mm/aaaa mientras el usuario escribe.
 * Acepta dígitos con o sin slashes — los normaliza automáticamente.
 * Ejemplo: "01062026" → "01/06/2026"
 * @param {string} text
 * @returns {string}
 */
export function autoFormatDate(text) {
  const digits = String(text || '').replace(/\D/g, '').slice(0, 8)
  let result = digits.slice(0, 2)
  if (digits.length > 2) result += '/' + digits.slice(2, 4)
  if (digits.length > 4) result += '/' + digits.slice(4, 8)
  return result
}

/**
 * Convierte YYYY-MM-DD → dd/mm/yyyy. Retorna '' si el input no es ISO válido.
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function isoToDdMmYyyy(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim().slice(0, 10))
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/**
 * Convierte dd/mm/yyyy → YYYY-MM-DD. Retorna null si el input no es válido.
 * @param {string | null | undefined} s
 * @returns {string | null}
 */
export function parseDdMmYyyyToIso(s) {
  if (!s || typeof s !== 'string') return null
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatEsDateFromIso(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const head = iso.length >= 10 ? iso.slice(0, 10) : iso
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head)
  if (!m) return '—'
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
