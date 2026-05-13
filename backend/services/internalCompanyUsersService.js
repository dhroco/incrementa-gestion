const crypto = require('crypto')
const { db } = require('../db/knex')
const { parseRut } = require('../utils/rut')
const { isValidEmail } = require('../utils/validation')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { getSupabaseAdminClient } = require('../lib/supabaseAdminClient')
const { resolveReadableCompanyId } = require('../lib/resolveReadableCompanyId')
/**
 * Usuarios vinculados a una empresa vía `company_internal_user` (p. ej. usuario empresa administrador).
 * Pensado para lectura por contador y para vistas de usuarios internos; la mutación sigue en usuarios plataforma cuando aplique.
 */

async function listInternalCompanyUsers({ userId, companyId: requestedCompanyId, q = '' }) {
  const gate = await resolveReadableCompanyId(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const qb = db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('auth.users as au', 'au.id', 'up.user_id')
    .join('company_internal_user as ciu', 'ciu.id', 'up.id')
    .select(
      'up.id',
      'au.email',
      'up.full_name',
      'up.phone',
      'up.rut_body',
      'up.rut_dv',
      'up.is_active',
      'p.code as profile_code',
      'p.label as profile_label',
      'ciu.company_id',
      'up.updated_at'
    )
    .where('ciu.company_id', companyId)

  const term = String(q || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    qb.andWhere((w) => {
      w.whereILike('au.email', t).orWhereILike('up.full_name', t).orWhereILike('up.phone', t)
    })
  }

  const rows = await qb.orderBy('au.email', 'asc')
  return { ok: true, data: { items: rows } }
}

async function getInternalCompanyUserDetail({ userId, companyId: requestedCompanyId, profileId }) {
  const gate = await resolveReadableCompanyId(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const row = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('auth.users as au', 'au.id', 'up.user_id')
    .join('company_internal_user as ciu', 'ciu.id', 'up.id')
    .select(
      'up.id',
      'au.email',
      'up.full_name',
      'up.phone',
      'up.rut_body',
      'up.rut_dv',
      'up.must_change_password',
      'up.is_active',
      'p.code as profile_code',
      'p.label as profile_label',
      'ciu.company_id'
    )
    .where('up.id', profileId)
    .where('ciu.company_id', companyId)
    .first()

  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Usuario no encontrado.' }

  return {
    ok: true,
    data: {
      user: {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        rut_body: row.rut_body,
        rut_dv: row.rut_dv,
        must_change_password: row.must_change_password,
        is_active: row.is_active,
        profile_code: row.profile_code,
        profile_label: row.profile_label
      },
      company_id: row.company_id
    }
  }
}

function generateTempPassword() {
  return `${crypto.randomBytes(18).toString('base64url')}Aa1!`
}

async function getProfileIdByCode(trx, code) {
  const row = await trx('profile').select('id').where({ code }).first()
  return row?.id ?? null
}

function validateInternalCreatePayload(body) {
  const email = normalizeAuthEmail(body?.email)
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const errors = []
  if (!email) errors.push('El correo es obligatorio.')
  else if (!isValidEmail(email)) errors.push('El correo no tiene un formato válido.')
  if (!fullName) errors.push('El nombre completo es obligatorio.')

  let is_active = true
  if (body?.is_active !== undefined) is_active = !!body.is_active
  else if (body?.isActive !== undefined) is_active = !!body.isActive

  let rutParsed = null
  if (body?.rut != null && String(body.rut).trim() !== '') {
    rutParsed = parseRut(body.rut)
    if (!rutParsed.ok) errors.push(rutParsed.message)
  }

  const phone = body?.phone != null ? String(body.phone).trim() : ''
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    data: {
      email,
      full_name: fullName,
      phone: phone || null,
      is_active,
      rut_body: rutParsed?.ok ? rutParsed.rut_body : null,
      rut_dv: rutParsed?.ok ? rutParsed.rut_dv : null
    }
  }
}

function validateInternalUpdatePayload(body) {
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : undefined
  const errors = []
  if (fullName !== undefined && fullName.length === 0) errors.push('El nombre completo no puede estar vacío.')

  const email = body?.email !== undefined ? normalizeAuthEmail(body.email) : undefined
  if (body?.email !== undefined && !email) errors.push('El correo no tiene un formato válido.')
  else if (email && !isValidEmail(email)) errors.push('El correo no tiene un formato válido.')

  const phone = body?.phone !== undefined ? String(body.phone ?? '').trim() : undefined

  let is_active
  if (body?.is_active !== undefined) is_active = !!body.is_active
  else if (body?.isActive !== undefined) is_active = !!body.isActive

  let rutParsed = null
  if (body?.rut !== undefined) {
    const rs = body.rut == null ? '' : String(body.rut).trim()
    rutParsed = rs === '' ? { ok: true, rut_body: null, rut_dv: null } : parseRut(body.rut)
    if (!rutParsed.ok) errors.push(rutParsed.message)
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    data: {
      full_name: fullName,
      email,
      phone: phone === '' ? null : phone,
      is_active,
      rut_body: rutParsed?.ok ? rutParsed.rut_body : undefined,
      rut_dv: rutParsed?.ok ? rutParsed.rut_dv : undefined
    }
  }
}

async function createInternalCompanyUser({ userId, companyId: requestedCompanyId, payload }) {
  const gate = await resolveReadableCompanyId(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const company_id = gate.companyId

  const v = validateInternalCreatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }
  }
  const { email, full_name, phone, is_active, rut_body, rut_dv } = v.data

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
  let newUserProfileId = null

  try {
    await db.transaction(async (trx) => {
      const profileId = await getProfileIdByCode(trx, 'USUARIO_EMPRESA_ADMINISTRADOR')
      if (!profileId) throw new Error('MISSING_TARGET_PROFILE')
      const okCo = await trx('company').select('id').where({ id: company_id }).first()
      if (!okCo) throw new Error('COMPANY_NOT_ASSIGNABLE')

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
      newUserProfileId = upId
      await trx('company_internal_user').insert({ id: upId, company_id })
    })
  } catch (e) {
    try {
      await admin.auth.admin.deleteUser(newAuthUserId)
    } catch {
      // best-effort
    }
    if (String(e.message) === 'COMPANY_NOT_ASSIGNABLE') {
      return { ok: false, status: 400, code: 'INVALID_COMPANY', message: 'La empresa indicada no existe.' }
    }
    if (String(e.message) === 'MISSING_TARGET_PROFILE') {
      return { ok: false, status: 500, code: 'CONFIG_ERROR', message: 'Configuración incompleta: falta perfil destino.' }
    }
    const code = e.code === '23505' ? 'DUPLICATE' : 'TRANSACTION_FAILED'
    const status = e.code === '23505' ? 409 : 500
    const message =
      e.code === '23505'
        ? 'Ya existe un usuario con ese correo.'
        : 'No se pudo completar el registro del usuario. Intente nuevamente.'
    return { ok: false, status, code, message }
  }

  const full = await getInternalCompanyUserDetail({ userId, companyId: company_id, profileId: newUserProfileId })
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

async function updateInternalCompanyUser({ userId, companyId: requestedCompanyId, profileId, payload }) {
  const gate = await resolveReadableCompanyId(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const existing = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('company_internal_user as ciu', 'ciu.id', 'up.id')
    .select('up.id', 'up.user_id', 'p.code as profile_code')
    .where('up.id', profileId)
    .where('ciu.company_id', companyId)
    .where('p.code', 'USUARIO_EMPRESA_ADMINISTRADOR')
    .first()

  if (!existing) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Usuario no encontrado.' }

  const v = validateInternalUpdatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }
  }
  const d = v.data

  const admin = getSupabaseAdminClient()
  if (d.email !== undefined && d.email !== null) {
    if (!admin) {
      return {
        ok: false,
        status: 503,
        code: 'ADMIN_CLIENT_UNAVAILABLE',
        message: 'Actualización de correo no está configurada en el servidor.'
      }
    }
    const { error: emailErr } = await admin.auth.admin.updateUserById(existing.user_id, { email: d.email })
    if (emailErr) {
      return {
        ok: false,
        status: 422,
        code: 'AUTH_UPDATE_FAILED',
        message: emailErr.message || 'No se pudo actualizar el correo en el servicio de autenticación.'
      }
    }
  }

  const upPatch = {}
  if (d.full_name !== undefined) upPatch.full_name = d.full_name
  if (d.phone !== undefined) upPatch.phone = d.phone
  if (d.is_active !== undefined) upPatch.is_active = d.is_active
  if (d.rut_body !== undefined) upPatch.rut_body = d.rut_body
  if (d.rut_dv !== undefined) upPatch.rut_dv = d.rut_dv

  if (Object.keys(upPatch).length) {
    await db('user_profile').where({ id: profileId }).update(upPatch)
  }

  return getInternalCompanyUserDetail({ userId, companyId, profileId })
}

module.exports = {
  listInternalCompanyUsers,
  getInternalCompanyUserDetail,
  resolveReadableCompanyId, // re-export from ../lib/resolveReadableCompanyId
  createInternalCompanyUser,
  updateInternalCompanyUser
}
