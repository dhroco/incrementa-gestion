const { db } = require('../db/knex')
const { parseRut } = require('../utils/rut')
const { isValidEmail } = require('../utils/validation')
const { resolveCompanyScopeByUserId } = require('./companyScopeService')

const MAX_BRANCHES = 50

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

function assertCanCreate(scope) {
  if (!scope || scope.profileCode !== 'ADMINISTRADOR_PLATAFORMA') {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para crear empresas.' }
  }
  return { ok: true }
}

function assertCanEdit(scope, companyId) {
  if (!scope) return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para editar empresas.' }
  if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') return { ok: true }
  if (scope.profileCode === 'USUARIO_EMPRESA_ADMINISTRADOR' && scope.mode === 'single' && scope.companyId === companyId) {
    return { ok: true }
  }
  if (scope.profileCode === 'CONTADOR') {
    if (scope.mode === 'set' && (scope.companyIds || []).includes(companyId)) return { ok: true }
  }
  return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para editar empresas.' }
}

function assertCanAssignAccountants(scope) {
  if (!scope || scope.profileCode !== 'ADMINISTRADOR_PLATAFORMA') {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para asignar contadores.' }
  }
  return { ok: true }
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

function validateBranchesPayload(rawBranches) {
  if (rawBranches === undefined) return { ok: true, branches: undefined }
  if (!Array.isArray(rawBranches)) {
    return { ok: false, errors: ['El campo sucursales (branches) debe ser un arreglo.'] }
  }
  if (rawBranches.length > MAX_BRANCHES) {
    return { ok: false, errors: [`No puede haber más de ${MAX_BRANCHES} sucursales.`] }
  }
  const errors = []
  const normalized = []
  for (let i = 0; i < rawBranches.length; i++) {
    const b = rawBranches[i] || {}
    const name = trimOrNull(b.name ?? b.nombre)
    if (!name) {
      errors.push(`La sucursal en la posición ${i + 1} debe tener un nombre.`)
      continue
    }
    const email = trimOrNull(b.email ?? b.correo)
    if (email && !isValidEmail(email)) {
      errors.push(`El correo de la sucursal "${name}" no tiene un formato válido.`)
    }
    normalized.push({
      name,
      address: trimOrNull(b.address ?? b.direccion),
      commune: trimOrNull(b.commune ?? b.comuna),
      city: trimOrNull(b.city ?? b.ciudad),
      region: trimOrNull(b.region ?? b.region),
      email,
      phone: trimOrNull(b.phone ?? b.telefono)
    })
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, branches: normalized }
}

function validateCompanyPayload(payload, { requireAll = false } = {}) {
  const errors = []
  const businessName = payload?.business_name ?? payload?.businessName ?? null
  const rutInput = payload?.rut ?? payload?.rut_input ?? payload?.rutInput ?? null
  const email = payload?.email ?? null

  const businessNameIsProvided = businessName !== undefined && businessName !== null
  const businessNameTrimmed = typeof businessName === 'string' ? businessName.trim() : ''
  if (requireAll && businessNameTrimmed.length === 0) {
    errors.push('Razón Social es obligatoria.')
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

  const bv = validateBranchesPayload(payload?.branches)
  if (!bv.ok) errors.push(...bv.errors)

  if (errors.length > 0) return { ok: false, errors }

  let branchesOut = bv.branches
  if (requireAll && branchesOut === undefined) branchesOut = []

  return {
    ok: true,
    data: {
      business_name: businessNameIsProvided ? businessNameTrimmed : undefined,
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
    },
    branches: branchesOut
  }
}

async function replaceCompanyBranches(trx, companyId, rows) {
  if (!(await trx.schema.hasTable('company_branch'))) return
  await trx('company_branch').where({ company_id: companyId }).del()
  if (!rows || rows.length === 0) return
  const now = trx.fn.now()
  await trx('company_branch').insert(
    rows.map((r, idx) => ({
      company_id: companyId,
      name: r.name,
      address: r.address,
      commune: r.commune,
      city: r.city,
      region: r.region,
      email: r.email,
      phone: r.phone,
      sort_order: idx,
      created_at: now,
      updated_at: now
    }))
  )
}

async function listCompanies({ userId, q = '' } = {}) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }

  const qb = db('company as c')
    .leftJoin('accountant_company as ac', 'ac.company_id', 'c.id')
    .leftJoin('user_profile as up', 'up.id', 'ac.accountant_id')
    .leftJoin('auth.users as au', 'au.id', 'up.user_id')
    .select(
      'c.id',
      'c.business_name',
      'c.rut_body',
      'c.rut_dv',
      'c.business_activity',
      'c.commune',
      'c.city',
      'c.updated_at'
    )
    .select(
      db.raw(
        `
        COALESCE(
          string_agg(DISTINCT au.email, ', ' ORDER BY au.email) FILTER (WHERE au.email IS NOT NULL),
          ''
        ) as accountants
      `
      )
    )

  applyScopeToCompanyQuery(qb, scope, { companyTableAlias: 'c' })

  const term = String(q || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    qb.andWhere((w) => {
      w.whereILike('c.business_name', t).orWhereILike('c.rut_body', t)
    })
  }

  qb.groupBy(
    'c.id',
    'c.business_name',
    'c.rut_body',
    'c.rut_dv',
    'c.business_activity',
    'c.commune',
    'c.city',
    'c.updated_at'
  )

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

  const accountants = await db('accountant_company as ac')
    .join('user_profile as up', 'up.id', 'ac.accountant_id')
    .leftJoin('auth.users as au', 'au.id', 'up.user_id')
    .select('up.id as id', 'au.email as email', 'up.full_name as full_name')
    .where('ac.company_id', companyId)
    .orderBy('au.email', 'asc')

  let branches = []
  if (await db.schema.hasTable('company_branch')) {
    branches = await db('company_branch')
      .select(
        'id',
        'name',
        'address',
        'commune',
        'city',
        'region',
        'email',
        'phone',
        'sort_order',
        'created_at',
        'updated_at'
      )
      .where({ company_id: companyId })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
  }

  return { ok: true, data: { ...row, accountants, branches } }
}

async function createCompany({ userId, payload }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  const perm = assertCanCreate(scope)
  if (!perm.ok) return perm

  const v = validateCompanyPayload(payload, { requireAll: true })
  if (!v.ok) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' ') }

  const branchRows = v.branches != null ? v.branches : []

  const insertData = Object.fromEntries(Object.entries(v.data).filter(([, val]) => val !== undefined))
  try {
    const row = await db.transaction(async (trx) => {
      const [created] = await trx('company').insert(insertData).returning('*')
      if (branchRows.length > 0) {
        await replaceCompanyBranches(trx, created.id, branchRows)
      }
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
  const perm = assertCanEdit(scope, companyId)
  if (!perm.ok) return perm

  const v = validateCompanyPayload(payload, { requireAll: false })
  if (!v.ok) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' ') }

  const patch = Object.fromEntries(Object.entries(v.data).filter(([, val]) => val !== undefined))
  const hasBranchUpdate = v.branches !== undefined
  if (Object.keys(patch).length === 0 && !hasBranchUpdate) {
    return { ok: false, status: 400, code: 'EMPTY_PAYLOAD', message: 'No hay campos para actualizar.' }
  }

  try {
    const row = await db.transaction(async (trx) => {
      let updatedRow = null
      if (Object.keys(patch).length > 0) {
        const updated = await trx('company').where({ id: companyId }).update(patch).returning('*')
        updatedRow = updated?.[0] ?? null
      } else {
        updatedRow = await trx('company').where({ id: companyId }).first()
      }
      if (!updatedRow) return null
      if (hasBranchUpdate) {
        await replaceCompanyBranches(trx, companyId, v.branches || [])
      }
      return updatedRow
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

async function listAccountantsCatalog({ userId }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }
  const perm = assertCanAssignAccountants(scope)
  if (!perm.ok) return perm

  const rows = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .leftJoin('auth.users as au', 'au.id', 'up.user_id')
    .select('up.id as id', 'au.email as email', 'p.code as profile_code')
    .where('p.code', 'CONTADOR')
    .orderBy('au.email', 'asc')

  return { ok: true, data: { items: rows } }
}

async function getCompanyAccountants({ userId, companyId }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  if (!scope) return { ok: false, status: 403, code: 'PROFILE_NOT_ASSIGNED', message: 'Perfil no asignado.' }

  const qb = db('company').select('id').where({ id: companyId })
  applyScopeToCompanyQuery(qb, scope)
  const visible = await qb.first()
  if (!visible) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Empresa no encontrada.' }

  const rows = await db('accountant_company as ac')
    .join('user_profile as up', 'up.id', 'ac.accountant_id')
    .leftJoin('auth.users as au', 'au.id', 'up.user_id')
    .select('up.id as id', 'au.email as email')
    .where('ac.company_id', companyId)
    .orderBy('au.email', 'asc')

  return { ok: true, data: { items: rows } }
}

async function setCompanyAccountants({ userId, companyId, accountantIds }) {
  const scope = await resolveCompanyScopeByUserId(userId)
  const perm = assertCanAssignAccountants(scope)
  if (!perm.ok) return perm

  const ids = Array.isArray(accountantIds) ? accountantIds.filter((x) => typeof x === 'string' && x.length > 0) : []

  const companyRow = await db('company').select('id').where({ id: companyId }).first()
  if (!companyRow) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Empresa no encontrada.' }

  await db.transaction(async (trx) => {
    await trx('accountant_company').where({ company_id: companyId }).del()
    if (ids.length > 0) {
      await trx('accountant_company')
        .insert(ids.map((aid) => ({ accountant_id: aid, company_id: companyId })))
        .onConflict(['accountant_id', 'company_id'])
        .ignore()
    }
  })

  return getCompanyAccountants({ userId, companyId })
}

module.exports = {
  listCompanies,
  getCompanyDetail,
  createCompany,
  updateCompany,
  listAccountantsCatalog,
  getCompanyAccountants,
  setCompanyAccountants
}
