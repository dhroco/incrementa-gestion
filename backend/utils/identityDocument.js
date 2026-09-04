const { parseRut } = require('./rut')

const COUNTRY_LABELS = Object.freeze({
  CL: 'Chile',
  MX: 'México'
})

const COUNTRY_CODE_RE = /^[A-Z]{2}$/

const RFC_PATTERN_PERSONA_NATURAL = '^[A-ZÑ&]{4}\\d{6}[A-Z0-9]{3}$'
const RFC_PATTERN_EMPRESA = '^[A-ZÑ&]{3}\\d{6}[A-Z0-9]{3}$'

const SEED_IDENTITY_DOCUMENT_TYPES = Object.freeze([
  {
    code: 'RUT',
    country_code: 'CL',
    label: 'RUT',
    label_long: 'Rol Único Tributario',
    validator_key: 'rut_cl',
    pattern: null,
    format_example: '12.345.678-5'
  },
  {
    code: 'RFC',
    country_code: 'MX',
    label: 'RFC',
    label_long: 'Registro Federal de Contribuyentes',
    validator_key: 'pattern_compact',
    pattern: JSON.stringify({
      persona_natural: RFC_PATTERN_PERSONA_NATURAL,
      empresa: RFC_PATTERN_EMPRESA
    }),
    format_example: 'LEGF870121MGA'
  }
])

function countryLabel(code) {
  const c = String(code || '').trim().toUpperCase()
  return COUNTRY_LABELS[c] || c
}

function formatRutDisplay(rutBody, rutDv) {
  const body = String(rutBody || '').replace(/\D/g, '')
  const dv = String(rutDv || '').toUpperCase()
  if (!body) return ''
  const parts = []
  let i = body.length
  while (i > 0) {
    const start = Math.max(0, i - 3)
    parts.unshift(body.slice(start, i))
    i = start
  }
  return dv ? `${parts.join('.')}-${dv}` : parts.join('.')
}

function normalizeCountryCode(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, message: 'Debe indicar el país del proveedor.' }
  }
  const code = String(raw).trim().toUpperCase()
  if (!COUNTRY_CODE_RE.test(code)) {
    return { ok: false, message: 'El país del proveedor no es válido.' }
  }
  return { ok: true, value: code }
}

function compactSearchTerm(term) {
  return String(term || '').replace(/[.\-\s]/g, '')
}

function parsePatternSpec(pattern, role) {
  if (pattern == null || String(pattern).trim() === '') return null
  const raw = String(pattern).trim()
  if (raw.startsWith('{')) {
    let obj
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
    const keyed = obj && typeof obj === 'object' ? obj[role] || obj.persona_natural : null
    return keyed ? String(keyed) : null
  }
  return raw
}

function compileRegex(source) {
  try {
    return new RegExp(source, 'u')
  } catch {
    return null
  }
}

// La normalizacion es una propiedad del TIPO de documento, no del validador.
// Antes se aplicaba la del RFC a todo tipo validado por patron, lo que obligaba
// a cualquier pais nuevo a perder su puntuacion (un CUIT 20-12345678-9 quedaba
// 20123456789) y a escribir el patron contra el valor ya comprimido.
function normalizePlain(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
}

function normalizeCompact(input) {
  return normalizePlain(input).replace(/[\s.\-]/g, '')
}

function validateRutCl(input, { required, label }) {
  if (input == null || String(input).trim() === '') {
    if (required) return { ok: false, message: `El ${label} es obligatorio.` }
    return { ok: true, canonical: null, display: '' }
  }
  const r = parseRut(input)
  if (!r.ok) return { ok: false, message: r.message }
  const canonical = `${r.rut_body}-${r.rut_dv}`
  return { ok: true, canonical, display: formatRutDisplay(r.rut_body, r.rut_dv) }
}

function validatePattern(input, documentType, { required, role, label }, normalize = normalizePlain) {
  if (input == null || String(input).trim() === '') {
    if (required) return { ok: false, message: `El ${label} es obligatorio.` }
    return { ok: true, canonical: null, display: '' }
  }
  const canonical = normalize(input)
  const source = parsePatternSpec(documentType.pattern, role)
  const re = source ? compileRegex(source) : null
  if (!re || !re.test(canonical)) {
    return { ok: false, message: `El ${label} ingresado no es válido.` }
  }
  return { ok: true, canonical, display: canonical }
}

const VALIDATORS = {
  rut_cl: (input, documentType, opts) => validateRutCl(input, opts),
  // Preserva la puntuacion tal como se escribe: el patron del catalogo se
  // escribe contra el identificador real del pais (ej. CUIT 20-12345678-9).
  pattern: (input, documentType, opts) => validatePattern(input, documentType, opts, normalizePlain),
  // Comprime espacios, puntos y guiones antes de validar. Es lo que necesita el
  // RFC mexicano, que se escribe indistintamente con o sin separadores.
  pattern_compact: (input, documentType, opts) =>
    validatePattern(input, documentType, opts, normalizeCompact)
}

/**
 * @param {{
 *   value: unknown,
 *   documentType: { code: string, label?: string, validator_key: string, pattern?: string | null },
 *   role: 'persona_natural' | 'empresa',
 *   required?: boolean
 * }} args
 */
function validateIdentityDocument({ value, documentType, role, required = true }) {
  const label = documentType?.label || 'documento'
  const key = documentType?.validator_key
  const fn = VALIDATORS[key]
  if (!fn) {
    return { ok: false, message: 'El tipo de documento no es válido.' }
  }
  return fn(value, documentType, { required, role, label })
}

function formatDocumentDisplay(documentType, canonical) {
  if (canonical == null || String(canonical).trim() === '') return ''
  const key = documentType?.validator_key
  if (key === 'rut_cl') {
    const raw = String(canonical).trim().toUpperCase()
    const dash = raw.lastIndexOf('-')
    if (dash > 0) {
      return formatRutDisplay(raw.slice(0, dash), raw.slice(dash + 1))
    }
    return formatRutDisplay(raw.slice(0, -1), raw.slice(-1))
  }
  return String(canonical).trim()
}

function typesForCountry(documentTypes, countryCode) {
  const code = String(countryCode || '').toUpperCase()
  return (documentTypes || []).filter((t) => String(t.country_code).toUpperCase() === code)
}

function resolveDocumentType({ documentTypes, countryCode, documentTypeCode }) {
  const forCountry = typesForCountry(documentTypes, countryCode)
  if (documentTypeCode) {
    const code = String(documentTypeCode).trim().toUpperCase()
    const found = forCountry.find((t) => String(t.code).toUpperCase() === code)
    if (!found) {
      return { ok: false, message: 'El tipo de documento no corresponde al país del proveedor.' }
    }
    return { ok: true, documentType: found }
  }
  if (forCountry.length === 1) return { ok: true, documentType: forCountry[0] }
  if (forCountry.length === 0) {
    return { ok: false, message: 'El país del proveedor no es válido.' }
  }
  return { ok: false, message: 'Debe indicar el tipo de documento.' }
}

module.exports = {
  COUNTRY_LABELS,
  COUNTRY_CODE_RE,
  RFC_PATTERN_PERSONA_NATURAL,
  RFC_PATTERN_EMPRESA,
  SEED_IDENTITY_DOCUMENT_TYPES,
  countryLabel,
  formatRutDisplay,
  formatDocumentDisplay,
  normalizeCountryCode,
  compactSearchTerm,
  validateIdentityDocument,
  typesForCountry,
  resolveDocumentType
}
