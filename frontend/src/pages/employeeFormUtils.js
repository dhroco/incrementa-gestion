/**
 * @param {string | null} iso
 * @returns {{ d: string, m: string, y: string }}
 */
export function splitIsoDateToParts(iso) {
  if (!iso || typeof iso !== 'string') return { d: '', m: '', y: '' }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return { d: '', m: '', y: '' }
  return { y: m[1], m: m[2], d: m[3] }
}

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

/**
 * @returns {string | null}
 */
export function joinPartsToIsoOrNull(d, m, y) {
  const di = String(d || '').trim()
  const mi = String(m || '').trim()
  const yi = String(y || '').trim()
  if (!di && !mi && !yi) return null
  if (!di || !mi || !yi) return null
  const day = di.padStart(2, '0')
  const mon = mi.padStart(2, '0')
  const yr = yi.padStart(4, '0')
  if (day.length > 2 || mon.length > 2 || yr.length > 4) return null
  if (Number(mon) < 1 || Number(mon) > 12) return null
  if (Number(day) < 1 || Number(day) > 31) return null
  return `${yr}-${mon}-${day}`
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function parseMoneyToDecimalString(raw) {
  if (raw == null || String(raw).trim() === '') return '0'
  const s = String(raw).trim().replace(/\./g, '').replace(/,/g, '.')
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return '0'
  return String(n)
}
