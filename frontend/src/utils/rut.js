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

export function parseRut(input) {
  const raw = normalizeRutInput(input)
  const compact = raw.replace(/[^0-9kK]/g, '')
  if (!compact) return { ok: false, message: 'El RUT es obligatorio.' }

  const upper = compact.toUpperCase()
  const bodyRaw = upper.length <= 8 ? upper : upper.slice(0, -1)
  const body = bodyRaw.replace(/\D/g, '')
  if (body.length < 7 || body.length > 8) return { ok: false, message: 'El RUT ingresado no es válido.' }
  const expected = computeRutDv(body)
  if (!expected) return { ok: false, message: 'El RUT ingresado no es válido.' }
  // Si vino cuerpo + DV y el DV no coincidía, se usa el DV módulo 11 (cuerpo válido 7–8 dígitos)
  return { ok: true, rutBody: body, rutDv: expected }
}

/** RUT opcional: cadena vacía se considera válida (sin partes). */
export function parseOptionalRut(input) {
  const raw = normalizeRutInput(input)
  const compact = raw.replace(/[^0-9kK]/g, '')
  if (!compact) return { ok: true, rutBody: '', rutDv: '' }
  return parseRut(input)
}

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

