import { formatRut } from './rut'

function repRut(ctx, n) {
  const body = ctx?.[`rut_body_legal_representative_${n}`]
  const dv = ctx?.[`rut_dv_legal_representative_${n}`]
  if (!body && !dv) return ''
  return formatRut(body, dv)
}

/**
 * Resolves embedded company variable placeholders for preview / export helpers.
 * @param {string} variableId
 * @param {Record<string, unknown>} companyContext - company row
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
    default:
      return ''
  }
}
