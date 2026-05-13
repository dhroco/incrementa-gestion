function normalizeRutInput(input) {
  if (input == null) return ''
  return String(input)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
}

function computeRutDv(rutBody) {
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
 * Accepts:
 * - with/without dots
 * - with/without hyphen
 * - with/without DV (heuristic: <=8 chars => body-only; >8 => last char is DV)
 *
 * Returns canonical parts: { rut_body, rut_dv } where dv is uppercase.
 */
function parseRut(input) {
  const raw = normalizeRutInput(input)
  const compact = raw.replace(/[^0-9kK]/g, '')
  if (!compact) {
    return { ok: false, code: 'RUT_EMPTY', message: 'El RUT es obligatorio.' }
  }

  const upper = compact.toUpperCase()
  let body = ''
  let dv = ''

  if (upper.length <= 8) {
    body = upper
    dv = computeRutDv(body)
  } else {
    body = upper.slice(0, -1)
    dv = upper.slice(-1)
  }

  body = body.replace(/\D/g, '')
  if (body.length < 7 || body.length > 8) {
    return { ok: false, code: 'RUT_INVALID', message: 'El RUT ingresado no es válido.' }
  }

  const expected = computeRutDv(body)
  if (!expected) {
    return { ok: false, code: 'RUT_INVALID', message: 'El RUT ingresado no es válido.' }
  }

  if (upper.length > 8 && dv !== expected) {
    // Cuerpo válido: normalizar al DV módulo 11 (típico error de tipeo; mismo criterio que RUT sin DV)
    dv = expected
  } else if (upper.length <= 8) {
    dv = expected
  }

  return { ok: true, rut_body: body, rut_dv: dv }
}

module.exports = { normalizeRutInput, computeRutDv, parseRut }

