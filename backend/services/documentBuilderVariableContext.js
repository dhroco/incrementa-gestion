function formatRutDisplay(rutBody, rutDv) {
  if (!rutBody) return ''
  return `${rutBody}-${rutDv ?? ''}`
}

/**
 * @param {string | null | undefined} body
 * @param {string | null | undefined} dv
 */
function companyRutDisplay(body, dv) {
  if (!body || String(body).trim() === '') return ''
  return formatRutDisplay(String(body).replace(/\D/g, ''), dv != null ? String(dv).trim().toUpperCase() : '')
}

/**
 * Build substitution map for one supplier row + company row.
 * @param {object} supplier — normalizeSupplier shape from supplierService
 * @param {object} company — raw company row
 * @param {object | null} client — normalizeClient shape from clientService, or null
 * @param {Record<string, string>} overrides
 * @returns {Record<string, string>}
 */
function buildSubstitutionMap(supplier, company, client = null, overrides = {}) {
  const isEmpresa = supplier?.supplier_type === 'empresa'
  const proveedorNombre = isEmpresa
    ? String(supplier?.razon_social || '').trim()
    : String(supplier?.full_name || '').trim()
  const proveedorRut = isEmpresa
    ? String(supplier?.rut_empresa_display || '').trim()
    : String(supplier?.rut_display || '').trim()
  const proveedorDireccion = isEmpresa
    ? String(supplier?.direccion_empresa || '').trim()
    : String(supplier?.address || '').trim()

  const base = {
    proveedor_nombre: proveedorNombre,
    proveedor_rut: proveedorRut,
    proveedor_direccion: proveedorDireccion,
    proveedor_giro: isEmpresa ? String(supplier?.giro || '').trim() : '',
    proveedor_rep_legal: isEmpresa ? String(supplier?.nombre_rep_legal || '').trim() : '',
    proveedor_rep_legal_rut: isEmpresa ? String(supplier?.rut_rep_legal_display || '').trim() : '',
    proveedor_red_social: '',
    proveedor_cuenta_social: '',
    company_legal_name: String(company?.business_name || '').trim(),
    company_nombre_comercial: String(company?.short_name || '').trim(),
    company_rut: companyRutDisplay(company?.rut_body, company?.rut_dv),
    company_email: String(company?.email || '').trim(),
    company_address: String(company?.address || '').trim(),
    company_commune: String(company?.commune || '').trim(),
    company_city: String(company?.city || '').trim(),
    company_region: String(company?.region || '').trim(),
    company_legal_rep1_name: String(company?.name_legal_representative_1 || '').trim(),
    company_legal_rep1_rut: companyRutDisplay(
      company?.rut_body_legal_representative_1,
      company?.rut_dv_legal_representative_1
    ),
    company_legal_rep2_name: String(company?.name_legal_representative_2 || '').trim(),
    company_legal_rep2_rut: companyRutDisplay(
      company?.rut_body_legal_representative_2,
      company?.rut_dv_legal_representative_2
    ),
    fecha_contrato: '',
    lugar_contrato: '',
    mes_ejecucion: '',
    cantidad_reels: '',
    precio_numero: '',
    precio_texto: '',
    client_name: client ? String(client.name || '').trim() : '',
    client_brand: client ? String(client.brand || '').trim() : '',
    client_brand_account: client ? String(client.brand_account || '').trim() : '',
    client_product_campaign: ''
  }

  const out = { ...base }
  for (const [k, v] of Object.entries(overrides || {})) {
    if (k && v != null && String(v).trim() !== '') out[k] = String(v)
  }
  return out
}

function placeholderKeysInText(text) {
  const s = new Set()
  const re = /\{\{([a-zA-Z0-9_]+)\}\}/gu
  let m
  while ((m = re.exec(String(text || '')))) {
    s.add(m[1])
  }
  return [...s]
}

function applySubstitutions(text, map) {
  return String(text || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/gu, (_, key) => {
    const v = map[key]
    return v != null && String(v).length > 0 ? String(v) : `{{${key}}}`
  })
}

function unresolvedKeys(text, map) {
  const keys = placeholderKeysInText(text)
  const missing = []
  for (const k of keys) {
    const v = map[k]
    if (v == null || String(v).trim() === '') missing.push(k)
  }
  return missing
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Deep-clone TipTap JSON and replace `variable` nodes and `{{key}}` tokens in text
 * using the same rules as `applySubstitutions` (empty map values keep `{{key}}`).
 * @param {unknown} doc
 * @param {Record<string, string>} map
 * @returns {unknown}
 */
function variableHasFormattingFlag(attrs, marks, type) {
  if (attrs && attrs[type]) return true
  return Array.isArray(marks) && marks.some((m) => m?.type === type)
}

function variableAttrsToMarks(attrs, marks = []) {
  /** @type {Array<{ type: string }>} */
  const out = []
  const add = (type) => {
    if (!out.some((m) => m.type === type)) out.push({ type })
  }
  if (variableHasFormattingFlag(attrs, marks, 'bold')) add('bold')
  if (variableHasFormattingFlag(attrs, marks, 'italic')) add('italic')
  if (variableHasFormattingFlag(attrs, marks, 'underline')) add('underline')
  if (variableHasFormattingFlag(attrs, marks, 'uppercase')) add('uppercase')
  return out
}

function variableShouldUppercase(attrs, marks) {
  return variableHasFormattingFlag(attrs, marks, 'uppercase')
}

function applySubstitutionsToTipTapDoc(doc, map) {
  const root = JSON.parse(JSON.stringify(doc))

  function walk(node) {
    if (!isPlainObject(node)) return
    if (node.type === 'variable') {
      const attrs = node.attrs && typeof node.attrs === 'object' ? node.attrs : {}
      const nodeMarks = Array.isArray(node.marks) ? node.marks : []
      const vid = typeof attrs.variableId === 'string' ? String(attrs.variableId).trim() : ''
      let val = vid && map[vid] != null ? String(map[vid]) : ''
      let token = vid ? (val.length > 0 ? val : `{{${vid}}}`) : ''
      if (variableShouldUppercase(attrs, nodeMarks) && token) {
        token = token.toUpperCase()
      }
      node.type = 'text'
      node.text = token
      const marks = variableAttrsToMarks(attrs, nodeMarks)
      if (marks.length > 0) node.marks = marks
      else delete node.marks
      delete node.attrs
      return
    }
    if (node.type === 'text' && typeof node.text === 'string') {
      node.text = applySubstitutions(node.text, map)
      if (Array.isArray(node.marks)) {
        const hasUppercase = node.marks.some((m) => m?.type === 'uppercase')
        if (hasUppercase) {
          node.text = node.text.toUpperCase()
        }
      }
      return
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c)
    }
  }

  walk(root)
  return root
}

module.exports = {
  buildSubstitutionMap,
  placeholderKeysInText,
  applySubstitutions,
  unresolvedKeys,
  applySubstitutionsToTipTapDoc
}
