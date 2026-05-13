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
 * Build substitution map for one employee row + company row + optional branches summary.
 * @param {object} employee — mapRow shape from employeeService
 * @param {object} company — raw company row + optional branches_text
 * @param {Record<string, string>} overrides
 * @returns {Record<string, string>}
 */
function buildSubstitutionMap(employee, company, overrides = {}) {
  const fullName = String(employee?.full_name || '').trim()
  const parts = fullName.split(/\s+/u)
  const firstName = parts[0] || ''
  const lastNames = parts.length > 1 ? parts.slice(1).join(' ') : ''

  const base = {
    worker_name: firstName,
    worker_lastname: lastNames,
    worker_rut: String(employee?.rut || '').trim(),
    worker_position: String(employee?.position_name || '').trim(),
    company_legal_name: String(company?.business_name || '').trim(),
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
    company_branches: String(company?.branches_text || '').trim() || '—',
    contract_type: '—',
    work_schedule: String(employee?.work_schedule_name || '').trim()
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
function applySubstitutionsToTipTapDoc(doc, map) {
  const root = JSON.parse(JSON.stringify(doc))

  function walk(node) {
    if (!isPlainObject(node)) return
    if (node.type === 'variable') {
      const vid = typeof node.attrs?.variableId === 'string' ? String(node.attrs.variableId).trim() : ''
      const val = vid && map[vid] != null ? String(map[vid]) : ''
      const token = vid ? (val.length > 0 ? val : `{{${vid}}}`) : ''
      node.type = 'text'
      node.text = token
      delete node.attrs
      delete node.marks
      return
    }
    if (node.type === 'text' && typeof node.text === 'string') {
      node.text = applySubstitutions(node.text, map)
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
