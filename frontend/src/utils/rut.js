function normalizeRutInput(input) {
  if (input == null) return ''
  return String(input)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
}

export function computeRutDv(rutBody) {
  const body = String(rutBody || '').replace(/\D/g, '')
  if (!body.length) return null
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const mod = 11 - (sum % 11)
  if (mod === 11) return '0'
  if (mod === 10) return 'K'
  return String(mod)
}

/**
 * El último carácter de la entrada compacta es siempre el dígito verificador.
 * El cuerpo debe ser solo dígitos y de largo 7 u 8. Si el dígito no corresponde
 * al módulo 11, se rechaza: no se calcula ni se reemplaza.
 *
 * @returns {{ ok: true, rutBody: string, rutDv: string } | { ok: false, message: string }}
 */
export function parseRut(input) {
  const upper = normalizeRutInput(input).toUpperCase()
  if (!upper) return { ok: false, message: 'El RUT es obligatorio.' }

  const dv = upper.slice(-1)
  const body = upper.slice(0, -1)

  if (!/^[0-9]{7,8}$/.test(body)) {
    return { ok: false, message: 'El RUT ingresado no es válido.' }
  }
  if (!/^[0-9K]$/.test(dv)) {
    return { ok: false, message: 'El RUT ingresado no es válido.' }
  }

  if (dv !== computeRutDv(body)) {
    return { ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }
  }

  return { ok: true, rutBody: body, rutDv: dv }
}

/** RUT opcional: cadena vacía se considera válida (sin partes). */
export function parseOptionalRut(input) {
  const raw = normalizeRutInput(input)
  const compact = raw.replace(/[^0-9kK]/g, '')
  if (!compact) return { ok: true, rutBody: '', rutDv: '' }
  return parseRut(input)
}

/** Placeholder estándar para campos de entrada de RUT (ver openspec/config.yaml → locale.rut_format). */
export const RUT_INPUT_PLACEHOLDER = '12.345.678-9'

export function formatRut(rutBody, rutDv) {
  const body = String(rutBody || '').replace(/\D/g, '')
  const dv = String(rutDv || '').toUpperCase()
  if (!body) return ''
  // Thousands separator with dots
  const parts = []
  let i = body.length
  while (i > 0) {
    const start = Math.max(0, i - 3)
    parts.unshift(body.slice(start, i))
    i = start
  }
  return dv ? `${parts.join('.')}-${dv}` : parts.join('.')
}

/**
 * Formatea un RUT ya parseable (cuerpo + DV o cadena con/sin separadores).
 * @param {string|null|undefined} value
 * @param {{ empty?: string }} [options]
 * @returns {string}
 */
export function formatRutDisplay(value, { empty = '—' } = {}) {
  if (value == null) return empty
  const trimmed = String(value).trim()
  if (!trimmed) return empty
  const parsed = parseOptionalRut(trimmed)
  if (parsed.ok && parsed.rutBody) {
    return formatRut(parsed.rutBody, parsed.rutDv)
  }
  return trimmed
}

/**
 * Formatea el valor de un campo de entrada al perder el foco (onBlur).
 * Si el RUT es inválido o incompleto, conserva lo escrito para no ocultar errores de validación.
 * @param {string|null|undefined} input
 * @returns {string}
 */
export function formatRutInput(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return ''
  const parsed = parseOptionalRut(trimmed)
  if (!parsed.ok || !parsed.rutBody) return trimmed
  return formatRut(parsed.rutBody, parsed.rutDv)
}
