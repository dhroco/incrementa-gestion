const { db } = require('../db/knex')
const { parseRut } = require('../utils/rut')
const { isValidEmail } = require('../utils/validation')
const { resolveCompanyScopeByUserId } = require('./companyScopeService')

/**
 * @param {import('knex').Knex.QueryBuilder} qb
 * @param {Awaited<ReturnType<import('./companyScopeService').resolveCompanyScopeByUserId>>} scope
 * @param {{ companyTableAlias?: string }} [opts] - Use `companyTableAlias: 'c'` when the query uses `from "company" as "c"` with joins (otherwise `id` is ambiguous).
 */
function applyScopeToCompanyQuery(qb, scope, opts = {}) {
  const idCol = opts.companyTableAlias ? `${opts.companyTableAlias}.id` : 'id'
  if (!scope) return qb.whereRaw('1=0')
  if (scope.mode === 'all') return qb
  if (scope.mode === 'single') {
    if (!scope.companyId) return qb.whereRaw('1=0')
    return qb.where(idCol, scope.companyId)
  }
  if (scope.mode === 'set') {
    const ids = Array.isArray(scope.companyIds) ? scope.companyIds : []
    if (ids.length === 0) return qb.whereRaw('1=0')
    return qb.whereIn(idCol, ids)
  }
  return qb.whereRaw('1=0')
}

function trimOrNull(v) {
  if (v == null) return null
  const t = String(v).trim()
  return t.length ? t : null
}

function parseRepRutFromPayload(payload, n) {
  const rutKey = `rut_legal_representative_${n}`
  const bodyKey = `rut_body_legal_representative_${n}`
  const dvKey = `rut_dv_legal_representative_${n}`
  const rutStr = payload?.[rutKey]
  if (rutStr != null && String(rutStr).trim().length > 0) {
    return parseRut(rutStr)
  }
  const body = payload?.[bodyKey]
  const dv = payload?.[dvKey]
  const b = body != null ? String(body).replace(/\D/g, '') : ''
  const d = dv != null ? String(dv).trim().toUpperCase() : ''
  if (!b && !d) return { ok: true, rut_body: null, rut_dv: null }
  const combined = `${b}${d}`
  return parseRut(combined)
}

function validateLegalRep(n, payload, errors) {
  const nameKey = `name_legal_representative_${n}`
  const name = trimOrNull(payload?.[nameKey] ?? payload?.[`nameLegalRepresentative${n}`])
  const rutParsed = parseRepRutFromPayload(payload, n)
  if (!rutParsed.ok) {
    errors.push(rutParsed.message || `El RUT del representante legal ${n} no es válido.`)
    return { name, rut_body: null, rut_dv: null }
  }
  if (rutParsed.rut_body && rutParsed.rut_dv) {
    return { name, rut_body: rutParsed.rut_body, rut_dv: rutParsed.rut_dv }
  }
  return { name, rut_body: null, rut_dv: null }
}

function validateCompanyPayload(payload, { requireAll = false } = {}) {
  const errors = []
  const businessName = payload?.business_name ?? payload?.businessName ?? null
  const shortName = trimOrNull(payload?.short_name ?? payload?.shortName ?? null)
  const rutInput = payload?.rut ?? payload?.rut_input ?? payload?.rutInput ?? null
  const email = payload?.email ?? null

  const businessNameIsProvided = businessName !== undefined && businessName !== null
  const businessNameTrimmed = typeof businessName === 'string' ? businessName.trim() : ''
  if (requireAll && businessNameTrimmed.length === 0) {
    errors.push('Razón Social es obligatoria.')
  }
  if (requireAll && !shortName) {
    errors.push('Nombre comercial es obligatorio.')
  }
  if (!requireAll && businessNameIsProvided && businessNameTrimmed.length === 0) {
    errors.push('Razón Social no puede estar vacía.')
  }

  const rutParsed = rutInput != null ? parseRut(rutInput) : null
  if (requireAll && !rutParsed?.ok) {
    errors.push(rutParsed?.message ?? 'El RUT ingresado no es válido.')
  }
  if (rutInput != null && rutParsed && !rutParsed.ok) {
    errors.push(rutParsed.message)
  }

  if (email != null && String(email).trim().length > 0 && !isValidEmail(email)) {
    errors.push('El correo ingresado no tiene un formato válido.')
  }

  const rep1 = validateLegalRep(1, payload, errors)
  const rep2 = validateLegalRep(2, payload, errors)

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      business_name: businessNameIsProvided ? businessNameTrimmed : undefined,
      short_name: shortName !== null ? shortName : undefined,
      rut_body: rutParsed?.ok ? rutParsed.rut_body : undefined,
      rut_dv: rutParsed?.ok ? rutParsed.rut_dv : undefined,
      business_activity: payload?.business_activity ?? payload?.giro ?? undefined,
      address: payload?.address ?? payload?.direccion ?? undefined,
      commune: payload?.commune ?? payload?.comuna ?? undefined,
      city: payload?.city ?? payload?.ciudad ?? undefined,
      region: payload?.region ?? undefined,
      email: email != null ? String(email).trim() : undefined,
      phone: payload?.phone ?? payload?.telefono ?? undefined,
      name_legal_representative_1: rep1.name,
      rut_body_legal_representative_1: rep1.rut_body,
      rut_dv_legal_representative_1: rep1.rut_dv,
      name_legal_representative_2: rep2.name,
      rut_body_legal_representative_2: rep2.rut_body,
      rut_dv_legal_representative_2: rep2.rut_dv
    }
  }
}

async function listCompanies({ userId, q = '' } = {}) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }

  const qb = db('company as c').select(
    'c.id',
    'c.business_name',
    'c.short_name',
    'c.rut_body',
    'c.rut_dv',
    'c.business_activity',
    'c.commune',
    'c.city',
    'c.updated_at'
  )

  applyScopeToCompanyQuery(qb, scope, { companyTableAlias: 'c' })

  const term = String(q || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    qb.andWhere((w) => {
      w.whereILike('c.business_name', t).orWhereILike('c.rut_body', t)
    })
  }

  qb.orderBy('c.updated_at', 'desc')

  const items = await qb
  return { ok: true, data: { items } }
}

async function getCompanyDetail({ userId, companyId }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }

  const qb = db('company').select('*').where({ id: companyId })
  applyScopeToCompanyQuery(qb, scope)
  const row = await qb.first()
  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Empresa no encontrada.' }

  return { ok: true, data: row }
}

async function createCompany({ userId, payload }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }

  const v = validateCompanyPayload(payload, { requireAll: true })
  if (!v.ok) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' ') }

  const insertData = Object.fromEntries(Object.entries(v.data).filter(([, val]) => val !== undefined))
  try {
    const row = await db.transaction(async (trx) => {
      const [created] = await trx('company').insert(insertData).returning('*')
      return created
    })
    const full = await getCompanyDetail({ userId, companyId: row.id })
    return { ok: true, status: 201, data: full.ok ? full.data : row }
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('company_rut_unique')) {
      return { ok: false, status: 409, code: 'RUT_DUPLICATED', message: 'Ya existe una empresa con ese RUT.' }
    }
    return { ok: false, status: 500, code: 'UNEXPECTED_ERROR', message: 'No se pudo crear la empresa.' }
  }
}

async function updateCompany({ userId, companyId, payload }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }

  const v = validateCompanyPayload(payload, { requireAll: false })
  if (!v.ok) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' ') }

  const patch = Object.fromEntries(Object.entries(v.data).filter(([, val]) => val !== undefined))
  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, code: 'EMPTY_PAYLOAD', message: 'No hay campos para actualizar.' }
  }

  try {
    const row = await db.transaction(async (trx) => {
      const updated = await trx('company').where({ id: companyId }).update(patch).returning('*')
      return updated?.[0] ?? null
    })
    if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Empresa no encontrada.' }
    const full = await getCompanyDetail({ userId, companyId })
    return { ok: true, data: full.ok ? full.data : row }
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('company_rut_unique')) {
      return { ok: false, status: 409, code: 'RUT_DUPLICATED', message: 'Ya existe una empresa con ese RUT.' }
    }
    return { ok: false, status: 500, code: 'UNEXPECTED_ERROR', message: 'No se pudo actualizar la empresa.' }
  }
}

module.exports = {
  listCompanies,
  getCompanyDetail,
  createCompany,
  updateCompany,
  validateCompanyPayload
}
