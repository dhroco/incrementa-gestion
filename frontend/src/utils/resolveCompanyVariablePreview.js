import { formatRut } from './rut'

function repRut(ctx, n) {
  const body = ctx?.[`rut_body_legal_representative_${n}`]
  const dv = ctx?.[`rut_dv_legal_representative_${n}`]
  if (!body && !dv) return ''
  return formatRut(body, dv)
}

function formatBranchBlock(b) {
  const lines = []
  if (b.name) lines.push(b.name)
  const loc = [b.address, b.commune, b.city, b.region].filter((x) => x && String(x).trim()).join(', ')
  if (loc) lines.push(loc)
  const contact = [b.email, b.phone].filter((x) => x && String(x).trim()).join(' · ')
  if (contact) lines.push(contact)
  return lines.join('\n')
}

/**
 * Resolves embedded company variable placeholders for preview / export helpers.
 * @param {string} variableId
 * @param {Record<string, unknown>} companyContext - company row + optional `branches` array
 * @returns {string}
 */
export function resolveCompanyVariablePreview(variableId, companyContext = {}) {
  const ctx = companyContext || {}
  switch (variableId) {
    case 'company_legal_name':
      return String(ctx.business_name ?? '').trim()
    case 'company_rut':
      return formatRut(ctx.rut_body, ctx.rut_dv)
    case 'company_email':
      return String(ctx.email ?? '').trim()
    case 'company_address':
      return String(ctx.address ?? '').trim()
    case 'company_commune':
      return String(ctx.commune ?? '').trim()
    case 'company_city':
      return String(ctx.city ?? '').trim()
    case 'company_region':
      return String(ctx.region ?? '').trim()
    case 'company_legal_rep1_name':
      return String(ctx.name_legal_representative_1 ?? '').trim()
    case 'company_legal_rep1_rut':
      return repRut(ctx, 1)
    case 'company_legal_rep2_name':
      return String(ctx.name_legal_representative_2 ?? '').trim()
    case 'company_legal_rep2_rut':
      return repRut(ctx, 2)
    case 'company_branches': {
      const branches = Array.isArray(ctx.branches) ? ctx.branches : []
      if (branches.length === 0) return ''
      return branches
        .slice()
        .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
        .map((b) => formatBranchBlock(b))
        .filter(Boolean)
        .join('\n\n')
    }
    default:
      return ''
  }
}
