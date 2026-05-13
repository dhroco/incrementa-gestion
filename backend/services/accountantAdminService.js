const crypto = require('crypto')
const { db } = require('../db/knex')
const { parseRut } = require('../utils/rut')
const { isValidEmail } = require('../utils/validation')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { getSupabaseAdminClient } = require('../lib/supabaseAdminClient')
const { resolveCompanyScopeByUserId } = require('./companyScopeService')

function assertPlatformAdmin(userId) {
  return resolveCompanyScopeByUserId(userId).then((scope) => {
    if (!scope || scope.profileCode !== 'ADMINISTRADOR_PLATAFORMA') {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para administrar contadores.' }
    }
    return { ok: true, scope }
  })
}

function generateTempPassword() {
  return `${crypto.randomBytes(18).toString('base64url')}Aa1!`
}

async function getContadorProfileId(trx) {
  const row = await trx('profile').select('id').where({ code: 'CONTADOR' }).first()
  return row?.id ?? null
}

function validateCreatePayload(body) {
  const email = normalizeAuthEmail(body?.email)
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const errors = []
  if (!email) errors.push('El correo es obligatorio.')
  else if (!isValidEmail(email)) errors.push('El correo no tiene un formato válido.')
  if (!fullName) errors.push('El nombre completo es obligatorio.')

  const rutParsed = body?.rut != null && String(body.rut).trim() !== '' ? parseRut(body.rut) : null
  if (body?.rut != null && String(body.rut).trim() !== '' && rutParsed && !rutParsed.ok) {
    errors.push(rutParsed.message)
  }

  const phone = body?.phone != null ? String(body.phone).trim() : ''
  const address = body?.address != null ? String(body.address).trim() : ''
  const commune = body?.commune != null ? String(body.commune).trim() : ''
  const city = body?.city != null ? String(body.city).trim() : ''

  const companyIds = Array.isArray(body?.company_ids) ? body.company_ids : Array.isArray(body?.companyIds) ? body.companyIds : []

  let is_active = true
  if (body?.is_active !== undefined) is_active = !!body.is_active
  else if (body?.isActive !== undefined) is_active = !!body.isActive

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    data: {
      email,
      full_name: fullName,
      phone: phone || null,
      rut_body: rutParsed?.ok ? rutParsed.rut_body : null,
      rut_dv: rutParsed?.ok ? rutParsed.rut_dv : null,
      address: address || null,
      commune: commune || null,
      city: city || null,
      company_ids: companyIds.filter((id) => typeof id === 'string' && id.length > 0),
      is_active
    }
  }
}

async function listAccountantsForAdmin({ userId, q = '' }) {
  const gate = await assertPlatformAdmin(userId)
  if (!gate.ok) return gate

  const qb = db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('auth.users as au', 'au.id', 'up.user_id')
    .join('accountant as a', 'a.id', 'up.id')
    .select(
      'up.id',
      'au.email',
      'up.full_name',
      'up.phone',
      'up.rut_body',
      'up.rut_dv',
      'up.must_change_password',
      'up.is_active',
      'a.address',
      'a.commune',
      'a.city',
      'a.updated_at'
    )
    .where('p.code', 'CONTADOR')

  const term = String(q || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    qb.andWhere((w) => {
      w.whereILike('au.email', t)
        .orWhereILike('up.full_name', t)
        .orWhereILike('a.commune', t)
        .orWhereILike('a.city', t)
        .orWhereILike('a.address', t)
        .orWhereILike('up.phone', t)
        .orWhereILike('up.rut_body', t)
        .orWhereILike('up.rut_dv', t)
    })
  }

  const rows = await qb.orderBy('au.email', 'asc')

  const ids = rows.map((r) => r.id)
  /** @type {Map<string, Array<{ id: string, business_name: string | null }>>} */
  const companiesByAccountant = new Map()
  if (ids.length) {
    const links = await db('accountant_company as ac')
      .join('company as c', 'c.id', 'ac.company_id')
      .whereIn('ac.accountant_id', ids)
      .select('ac.accountant_id', 'c.id as company_id', 'c.business_name')
      .orderBy('c.business_name', 'asc')

    for (const link of links) {
      const aid = link.accountant_id
      const list = companiesByAccountant.get(aid) || []
      list.push({ id: link.company_id, business_name: link.business_name })
      companiesByAccountant.set(aid, list)
    }
  }

  const items = rows.map((r) => ({
    ...r,
    companies: companiesByAccountant.get(r.id) || []
  }))

  return { ok: true, data: { items } }
}

async function getAccountantDetailForAdmin({ userId, accountantUserProfileId }) {
  const gate = await assertPlatformAdmin(userId)
  if (!gate.ok) return gate

  const row = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('auth.users as au', 'au.id', 'up.user_id')
    .join('accountant as a', 'a.id', 'up.id')
    .select(
      'up.id',
      'au.email',
      'up.full_name',
      'up.phone',
      'up.rut_body',
      'up.rut_dv',
      'up.must_change_password',
      'up.is_active',
      'a.address',
      'a.commune',
      'a.city'
    )
    .where('p.code', 'CONTADOR')
    .where('up.id', accountantUserProfileId)
    .first()

  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Contador no encontrado.' }

  const companies = await db('accountant_company as ac')
    .join('company as c', 'c.id', 'ac.company_id')
    .select('c.id', 'c.business_name')
    .where('ac.accountant_id', accountantUserProfileId)

  return { ok: true, data: { accountant: row, companies } }
}

/** Comprueba que cada id corresponde a una fila existente en `company`. */
async function validateAssignableCompanyIds(trx, ids) {
  if (!ids.length) return true
  const rows = await trx('company').select('id').whereIn('id', ids)
  return rows.length === ids.length
}

async function createAccountant({ userId, payload }) {
  const gate = await assertPlatformAdmin(userId)
  if (!gate.ok) return gate

  const v = validateCreatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }
  }
  const { email, full_name, phone, rut_body, rut_dv, address, commune, city, company_ids, is_active } = v.data

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return {
      ok: false,
      status: 503,
      code: 'ADMIN_CLIENT_UNAVAILABLE',
      message: 'El aprovisionamiento de usuarios no está configurado (falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).'
    }
  }

  const tempPassword = generateTempPassword()

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true
  })

  if (createErr || !created?.user?.id) {
    const msg = createErr?.message || 'No se pudo crear el usuario en el servicio de autenticación.'
    return { ok: false, status: 422, code: 'AUTH_CREATE_FAILED', message: msg }
  }

  const newAuthUserId = created.user.id

  try {
    await db.transaction(async (trx) => {
      const profileId = await getContadorProfileId(trx)
      if (!profileId) throw new Error('MISSING_CONTADOR_PROFILE')

      const okCompanies = await validateAssignableCompanyIds(trx, company_ids)
      if (!okCompanies) throw new Error('INVALID_COMPANY_IDS')

      const insertedRows = await trx('user_profile')
        .insert({
          user_id: newAuthUserId,
          profile_id: profileId,
          full_name,
          phone,
          rut_body,
          rut_dv,
          must_change_password: true,
          is_active: !!is_active
        })
        .returning('id')

      const upId = insertedRows?.[0]?.id
      if (!upId) throw new Error('USER_PROFILE_INSERT_FAILED')

      await trx('accountant').insert({
        id: upId,
        address,
        commune,
        city
      })

      if (company_ids.length) {
        const rows = company_ids.map((company_id) => ({
          accountant_id: upId,
          company_id
        }))
        await trx('accountant_company').insert(rows)
      }
    })
  } catch (e) {
    try {
      await admin.auth.admin.deleteUser(newAuthUserId)
    } catch {
      // best-effort compensation
    }
    if (String(e.message) === 'INVALID_COMPANY_IDS') {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_COMPANY',
        message: 'Una o más empresas no existen.'
      }
    }
    if (String(e.message) === 'MISSING_CONTADOR_PROFILE') {
      return { ok: false, status: 500, code: 'CONFIG_ERROR', message: 'Configuración incompleta: falta perfil CONTADOR.' }
    }
    const code = e.code === '23505' ? 'DUPLICATE' : 'TRANSACTION_FAILED'
    const status = e.code === '23505' ? 409 : 500
    const message =
      e.code === '23505'
        ? 'Ya existe un usuario con ese correo.'
        : 'No se pudo completar el registro del contador. Intente nuevamente.'
    return { ok: false, status, code, message }
  }

  const createdRow = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .where('p.code', 'CONTADOR')
    .where('up.user_id', newAuthUserId)
    .select('up.id')
    .first()

  const full = createdRow?.id
    ? await getAccountantDetailForAdmin({ userId, accountantUserProfileId: createdRow.id })
    : { ok: false, status: 500, code: 'UNEXPECTED', message: 'No se pudo recuperar el contador creado.' }

  if (!full.ok) return full

  return {
    ok: true,
    status: 201,
    data: {
      ...full.data,
      temporary_password: tempPassword
    }
  }
}

function validateUpdatePayload(body) {
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : undefined
  const errors = []
  if (fullName !== undefined && fullName.length === 0) errors.push('El nombre completo no puede estar vacío.')

  const rutParsed = body?.rut !== undefined ? (String(body.rut || '').trim() === '' ? { ok: true, rut_body: null, rut_dv: null } : parseRut(body.rut)) : null
  if (rutParsed && !rutParsed.ok) errors.push(rutParsed.message)

  const phone = body?.phone !== undefined ? String(body.phone ?? '').trim() : undefined
  const address = body?.address !== undefined ? String(body.address ?? '').trim() : undefined
  const commune = body?.commune !== undefined ? String(body.commune ?? '').trim() : undefined
  const city = body?.city !== undefined ? String(body.city ?? '').trim() : undefined

  let is_active
  if (body?.is_active !== undefined) {
    is_active = !!body.is_active
  } else if (body?.isActive !== undefined) {
    is_active = !!body.isActive
  }

  const companyIds = Array.isArray(body?.company_ids)
    ? body.company_ids
    : Array.isArray(body?.companyIds)
      ? body.companyIds
      : undefined

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    data: {
      full_name: fullName,
      phone: phone === '' ? null : phone,
      rut_body: rutParsed?.ok ? rutParsed.rut_body : undefined,
      rut_dv: rutParsed?.ok ? rutParsed.rut_dv : undefined,
      address: address === '' ? null : address,
      commune: commune === '' ? null : commune,
      city: city === '' ? null : city,
      is_active: is_active,
      company_ids: companyIds
    }
  }
}

async function updateAccountant({ userId, accountantUserProfileId, payload }) {
  const gate = await assertPlatformAdmin(userId)
  if (!gate.ok) return gate

  const v = validateUpdatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }
  }

  const exists = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .where('up.id', accountantUserProfileId)
    .where('p.code', 'CONTADOR')
    .first()

  if (!exists) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Contador no encontrado.' }

  const d = v.data

  try {
    await db.transaction(async (trx) => {
      const upPatch = {}
      if (d.full_name !== undefined) upPatch.full_name = d.full_name
      if (d.phone !== undefined) upPatch.phone = d.phone
      if (d.rut_body !== undefined) upPatch.rut_body = d.rut_body
      if (d.rut_dv !== undefined) upPatch.rut_dv = d.rut_dv
      if (Object.keys(upPatch).length) {
        await trx('user_profile').where({ id: accountantUserProfileId }).update(upPatch)
      }

      const accPatch = {}
      if (d.address !== undefined) accPatch.address = d.address
      if (d.commune !== undefined) accPatch.commune = d.commune
      if (d.city !== undefined) accPatch.city = d.city
      if (Object.keys(accPatch).length) {
        await trx('accountant').where({ id: accountantUserProfileId }).update(accPatch)
      }
      if (d.is_active !== undefined) {
        await trx('user_profile').where({ id: accountantUserProfileId }).update({ is_active: d.is_active })
      }

      if (d.company_ids !== undefined) {
        const ids = d.company_ids.filter((x) => typeof x === 'string' && x.length > 0)
        const okCompanies = await validateAssignableCompanyIds(trx, ids)
        if (!okCompanies) throw new Error('INVALID_COMPANY_IDS')
        await trx('accountant_company').where({ accountant_id: accountantUserProfileId }).del()
        if (ids.length) {
          await trx('accountant_company').insert(ids.map((company_id) => ({ accountant_id: accountantUserProfileId, company_id })))
        }
      }
    })
  } catch (e) {
    if (String(e.message) === 'INVALID_COMPANY_IDS') {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_COMPANY',
        message: 'Una o más empresas no existen.'
      }
    }
    return { ok: false, status: 500, code: 'UPDATE_FAILED', message: 'No se pudo actualizar el contador.' }
  }

  return getAccountantDetailForAdmin({ userId, accountantUserProfileId })
}

async function completePasswordRotation({ userId }) {
  const profile = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .select('up.id', 'up.is_active', 'p.code')
    .where('up.user_id', userId)
    .first()

  if (!profile) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No se pudo completar esta acción.' }
  }

  if (profile.code === 'CONTADOR') {
    if (profile.is_active === false) {
      return { ok: false, status: 403, code: 'ACCOUNTANT_INACTIVE', message: 'Su usuario contador está deshabilitado.' }
    }
  } else if (profile.code === 'ADMINISTRADOR_PLATAFORMA' || profile.code === 'USUARIO_EMPRESA_ADMINISTRADOR') {
    if (profile.is_active === false) {
      return { ok: false, status: 403, code: 'USER_INACTIVE', message: 'Su usuario está deshabilitado.' }
    }
  } else {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Esta acción no aplica a su perfil.' }
  }

  await db('user_profile').where({ id: profile.id }).update({ must_change_password: false })
  return { ok: true, data: { must_change_password: false } }
}

module.exports = {
  listAccountantsForAdmin,
  getAccountantDetailForAdmin,
  createAccountant,
  updateAccountant,
  completePasswordRotation
}
