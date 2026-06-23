import { parseOptionalRut, parseRut } from './rut'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

/** Headquarters email: empty is valid. */
export function isValidEmailField(v) {
  if (!isNonEmptyString(v)) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

/**
 * Same rules as company create/edit forms before calling the API.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateHeadquartersForCompanySubmit({ businessName, shortName, rut, email, rutLegal1, rutLegal2 }) {
  if (!isNonEmptyString(businessName)) {
    return { ok: false, message: 'La razón social es obligatoria.' }
  }
  if (!isNonEmptyString(shortName)) {
    return { ok: false, message: 'El nombre comercial es obligatorio.' }
  }
  const rutCheck = parseRut(rut)
  if (!rutCheck.ok) {
    return { ok: false, message: rutCheck.message || 'RUT inválido.' }
  }
  if (!isValidEmailField(email)) {
    return { ok: false, message: 'Correo inválido.' }
  }
  const rutLegal1Check = parseOptionalRut(rutLegal1)
  if (!rutLegal1Check.ok) {
    return { ok: false, message: rutLegal1Check.message || 'RUT del representante legal 1 inválido.' }
  }
  const rutLegal2Check = parseOptionalRut(rutLegal2)
  if (!rutLegal2Check.ok) {
    return { ok: false, message: rutLegal2Check.message || 'RUT del representante legal 2 inválido.' }
  }
  return { ok: true }
}

/**
 * Body for `createCompany` / `updateCompany` (snake_case fields).
 * @param {{
 *   businessName: string,
 *   shortName: string,
 *   rut: string,
 *   businessActivity: string,
 *   address: string,
 *   commune: string,
 *   city: string,
 *   region: string,
 *   email: string,
 *   phone: string,
 *   nameLegal1: string,
 *   rutLegal1: string,
 *   nameLegal2: string,
 *   rutLegal2: string
 * }} p
 */
export function buildCompanyMutationPayload(p) {
  return {
    business_name: p.businessName,
    short_name: p.shortName?.trim() || null,
    rut: p.rut,
    business_activity: p.businessActivity.trim() || null,
    address: p.address.trim() || null,
    commune: p.commune.trim() || null,
    city: p.city.trim() || null,
    region: p.region.trim() || null,
    email: p.email.trim() || null,
    phone: p.phone.trim() || null,
    name_legal_representative_1: p.nameLegal1.trim() || null,
    rut_legal_representative_1: p.rutLegal1.trim() || null,
    name_legal_representative_2: p.nameLegal2.trim() || null,
    rut_legal_representative_2: p.rutLegal2.trim() || null
  }
}
