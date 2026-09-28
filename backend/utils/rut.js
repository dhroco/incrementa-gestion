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
 * El último carácter de la entrada compacta es siempre el dígito verificador.
 * El cuerpo debe ser solo dígitos y de largo 7 u 8. Si el dígito no corresponde
 * al módulo 11, se rechaza: no se calcula ni se reemplaza.
 *
 * @returns {{ ok: true, rut_body: string, rut_dv: string } | { ok: false, code: string, message: string }}
 */
function parseRut(input) {
  const upper = normalizeRutInput(input).toUpperCase()
  if (!upper) {
    return { ok: false, code: 'RUT_EMPTY', message: 'El RUT es obligatorio.' }
  }

  const dv = upper.slice(-1)
  const body = upper.slice(0, -1)

  if (!/^[0-9]{7,8}$/.test(body)) {
    return { ok: false, code: 'RUT_INVALID', message: 'El RUT ingresado no es válido.' }
  }
  if (!/^[0-9K]$/.test(dv)) {
    return { ok: false, code: 'RUT_INVALID', message: 'El RUT ingresado no es válido.' }
  }

  if (dv !== computeRutDv(body)) {
    return {
      ok: false,
      code: 'RUT_DV_MISMATCH',
      message: 'El dígito verificador no corresponde al RUT ingresado.'
    }
  }

  return { ok: true, rut_body: body, rut_dv: dv }
}

module.exports = { normalizeRutInput, computeRutDv, parseRut }
