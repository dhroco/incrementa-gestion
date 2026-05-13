const crypto = require('crypto')
const { db } = require('../db/knex')
const { isValidEmail } = require('../utils/validation')
const { parseRut } = require('../utils/rut')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { getSupabaseAdminClient } = require('../lib/supabaseAdminClient')
const { resolveCompanyScopeByUserId } = require('./companyScopeService')

const PLATFORM_PROFILE_CODES = new Set(['ADMINISTRADOR_PLATAFORMA', 'USUARIO_EMPRESA_ADMINISTRADOR'])

function assertPlatformUsersManager(userId) {
  return resolveCompanyScopeByUserId(userId).then((scope) => {
    if (!scope) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Perfil no asignado.' }
    }
    if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
      return { ok: true, scope, access: 'platform' }
    }
    if (scope.profileCode === 'USUARIO_EMPRESA_ADMINISTRADOR' && scope.mode === 'single' && scope.companyId) {
      return { ok: true, scope, access: 'company', companyId: scope.companyId }
    }
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'No tiene permisos para administrar usuarios de plataforma.'
    }
  })
}

function generateTempPassword() {
  return `${crypto.randomBytes(18).toString('base64url')}Aa1!`
}

async function getProfileIdByCode(trx, code) {
  const row = await trx('profile').select('id').where({ code }).first()
  return row?.id ?? null
}

function validateCreatePayload(body) {
  const email = normalizeAuthEmail(body?.email)
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const profileCode =
    typeof body?.profile_code === 'string'
      ? body.profile_code.trim()
      : typeof body?.profileCode === 'string'
        ? body.profileCode.trim()
        : ''
  const companyIdRaw = body?.company_id ?? body?.companyId
  const company_id = typeof companyIdRaw === 'string' && companyIdRaw.trim() !== '' ? companyIdRaw.trim() : null

  const errors = []
  if (!email) errors.push('El correo es obligatorio.')
  else if (!isValidEmail(email)) errors.push('El correo no tiene un formato válido.')
  if (!fullName) errors.push('El nombre completo es obligatorio.')
  if (!profileCode || !PLATFORM_PROFILE_CODES.has(profileCode)) {
    errors.push('Debe seleccionar un perfil válido.')
  }
  if (profileCode === 'USUARIO_EMPRESA_ADMINISTRADOR' && !company_id) {
    errors.push('Debe seleccionar una empresa para el perfil usuario empresa administrador.')
  }

  const phone = body?.phone != null ? String(body.phone).trim() : ''

  let is_active = true
  if (body?.is_active !== undefined) is_active = !!body.is_active
  else if (body?.isActive !== undefined) is_active = !!body.isActive

  const rutParsed =
    body?.rut != null && String(body.rut).trim() !== ''
      ? parseRut(body.rut)
      : body?.rut_body != null || body?.rut_dv != null
        ? parseRut(`${String(body?.rut_body ?? '').trim()}-${String(body?.rut_dv ?? '').trim()}`)
        : null
  if (body?.rut != null && String(body.rut).trim() !== '' && rutParsed && !rutParsed.ok) {
    errors.push(rutParsed.message)
  }
  if (
    (body?.rut_body != null || body?.rut_dv != null) &&
    (String(body?.rut_body ?? '').trim() !== '' || String(body?.rut_dv ?? '').trim() !== '') &&
    rutParsed &&
    !rutParsed.ok
  ) {
    errors.push(rutParsed.message)
  }

  if (errors.length) return { ok: false, errors }
  const rut_body = rutParsed?.ok ? rutParsed.rut_body : null
  const rut_dv = rutParsed?.ok ? rutParsed.rut_dv : null
  return {
    ok: true,
    data: {
      email,
      full_name: fullName,
      phone: phone || null,
      profile_code: profileCode,
      company_id,
      is_active,
      rut_body,
      rut_dv
    }
  }
}

function validateUpdatePayload(body) {
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

  const profileCode =
    body?.profile_code !== undefined
      ? String(body.profile_code || '').trim()
      : body?.profileCode !== undefined
        ? String(body.profileCode || '').trim()
        : undefined

  if (profileCode !== undefined && profileCode.length > 0 && !PLATFORM_PROFILE_CODES.has(profileCode)) {
    errors.push('Perfil no válido.')
  }

  const companyIdRaw = body?.company_id ?? body?.companyId
  const company_id =
    companyIdRaw !== undefined
      ? typeof companyIdRaw === 'string' && companyIdRaw.trim() !== ''
        ? companyIdRaw.trim()
        : null
      : undefined

  let rutParsed = null
  if (body?.rut !== undefined) {
    const rs = body.rut == null ? '' : String(body.rut).trim()
    rutParsed = rs === '' ? { ok: true, rut_body: null, rut_dv: null } : parseRut(body.rut)
    if (!rutParsed.ok) errors.push(rutParsed.message)
  } else if (body?.rut_body !== undefined || body?.rut_dv !== undefined) {
    const b = String(body?.rut_body ?? '').trim()
    const d = String(body?.rut_dv ?? '').trim()
    if (b || d) {
      rutParsed = parseRut(`${b}-${d}`)
      if (!rutParsed.ok) errors.push(rutParsed.message)
    }
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    data: {
      full_name: fullName,
      email,
      phone: phone === '' ? null : phone,
      is_active,
      profile_code: profileCode === '' ? undefined : profileCode,
      company_id,
      rut_body: rutParsed?.ok ? rutParsed.rut_body : undefined,
      rut_dv: rutParsed?.ok ? rutParsed.rut_dv : undefined
    }
  }
}

async function listPlatformUsersForAdmin({ userId, q = '' }) {
  const gate = await assertPlatformUsersManager(userId)
  if (!gate.ok) return gate

  const qb = db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('auth.users as au', 'au.id', 'up.user_id')
    .leftJoin('company_internal_user as ciu', 'ciu.id', 'up.id')
    .leftJoin('company as c', 'c.id', 'ciu.company_id')
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
      'ciu.company_id',
      'c.business_name as company_business_name',
      'up.updated_at'
    )
    .whereIn('p.code', ['ADMINISTRADOR_PLATAFORMA', 'USUARIO_EMPRESA_ADMINISTRADOR'])

  if (gate.access === 'company') {
    qb.where('ciu.company_id', gate.companyId)
  }

  const term = String(q || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    qb.andWhere((w) => {
      w.whereILike('au.email', t)
        .orWhereILike('up.full_name', t)
        .orWhereILike('up.phone', t)
        .orWhereILike('c.business_name', t)
    })
  }

  const rows = await qb.orderBy('au.email', 'asc')
  const items = rows.map((r) => ({
    ...r,
    company: r.company_id ? { id: r.company_id, business_name: r.company_business_name } : null
  }))
  return { ok: true, data: { items } }
}

async function getPlatformUserDetailForAdmin({ userId, platformUserProfileId }) {
  const gate = await assertPlatformUsersManager(userId)
  if (!gate.ok) return gate

  const row = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .join('auth.users as au', 'au.id', 'up.user_id')
    .leftJoin('company_internal_user as ciu', 'ciu.id', 'up.id')
    .leftJoin('company as c', 'c.id', 'ciu.company_id')
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
      'ciu.company_id',
      'c.business_name as company_business_name'
    )
    .whereIn('p.code', ['ADMINISTRADOR_PLATAFORMA', 'USUARIO_EMPRESA_ADMINISTRADOR'])
    .where('up.id', platformUserProfileId)
    .first()

  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Usuario no encontrado.' }

  if (gate.access === 'company' && row.company_id !== gate.companyId) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para ver este usuario.' }
  }

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
      company: row.company_id ? { id: row.company_id, business_name: row.company_business_name } : null
    }
  }
}

async function validateCompanyExists(trx, companyId) {
  if (!companyId) return false
  const row = await trx('company').select('id').where({ id: companyId }).first()
  return !!row
}

/** La empresa debe existir para asignarla a un usuario empresa administrador. */
async function validateCompanyAssignable(trx, companyId) {
  if (!companyId) return false
  const row = await trx('company').select('id').where({ id: companyId }).first()
  return !!row
}

async function createPlatformUser({ userId, payload }) {
  const gate = await assertPlatformUsersManager(userId)
  if (!gate.ok) return gate

  const v = validateCreatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }
  }
  let { email, full_name, phone, profile_code, company_id, is_active, rut_body, rut_dv } = v.data

  if (gate.access === 'company') {
    if (profile_code !== 'USUARIO_EMPRESA_ADMINISTRADOR') {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'Solo puede crear usuarios con perfil usuario empresa administrador para su empresa.'
      }
    }
    company_id = gate.companyId
  }

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
  /** @type {string | null} */
  let newUserProfileId = null

  try {
    await db.transaction(async (trx) => {
      const profileId = await getProfileIdByCode(trx, profile_code)
      if (!profileId) throw new Error('MISSING_TARGET_PROFILE')

      if (profile_code === 'USUARIO_EMPRESA_ADMINISTRADOR') {
        const okCo = await validateCompanyAssignable(trx, company_id)
        if (!okCo) throw new Error('COMPANY_NOT_ASSIGNABLE')
      }

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

      if (profile_code === 'USUARIO_EMPRESA_ADMINISTRADOR') {
        await trx('company_internal_user').insert({
          id: upId,
          company_id
        })
      }
    })
  } catch (e) {
    try {
      await admin.auth.admin.deleteUser(newAuthUserId)
    } catch {
      // best-effort
    }
    if (String(e.message) === 'COMPANY_NOT_ASSIGNABLE') {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_COMPANY',
        message: 'La empresa indicada no existe o no está disponible para asignación.'
      }
    }
    if (String(e.message) === 'INVALID_COMPANY_ID') {
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

  if (!newUserProfileId) {
    return { ok: false, status: 500, code: 'UNEXPECTED', message: 'No se pudo determinar el usuario creado.' }
  }

  const full = await getPlatformUserDetailForAdmin({ userId, platformUserProfileId: newUserProfileId })
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

async function updatePlatformUser({ userId, platformUserProfileId, payload }) {
  const gate = await assertPlatformUsersManager(userId)
  if (!gate.ok) return gate

  const v = validateUpdatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }
  }

  const existing = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .select('up.id', 'up.user_id', 'p.code as profile_code')
    .where('up.id', platformUserProfileId)
    .whereIn('p.code', ['ADMINISTRADOR_PLATAFORMA', 'USUARIO_EMPRESA_ADMINISTRADOR'])
    .first()

  if (!existing) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Usuario no encontrado.' }

  if (gate.access === 'company') {
    const ciu = await db('company_internal_user').select('company_id').where({ id: platformUserProfileId }).first()
    if (!ciu || ciu.company_id !== gate.companyId) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No tiene permisos para modificar este usuario.' }
    }
    if (payload?.profile_code && payload.profile_code !== 'USUARIO_EMPRESA_ADMINISTRADOR') {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'No puede asignar ese perfil desde su cuenta.'
      }
    }
    const bodyCompany = payload?.company_id ?? payload?.companyId
    if (bodyCompany !== undefined && bodyCompany !== null && String(bodyCompany).trim() !== '') {
      if (String(bodyCompany).trim() !== String(gate.companyId)) {
        return {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'Solo puede asignar usuarios a su propia empresa.'
        }
      }
    }
  }

  const admin = getSupabaseAdminClient()
  const d = v.data

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

  try {
    await db.transaction(async (trx) => {
      let nextProfileCode = existing.profile_code
      if (d.profile_code !== undefined && d.profile_code.length > 0) {
        nextProfileCode = d.profile_code
      }

      const nextProfileId = await getProfileIdByCode(trx, nextProfileCode)
      if (!nextProfileId) throw new Error('MISSING_TARGET_PROFILE')

      const upPatch = {}
      if (d.full_name !== undefined) upPatch.full_name = d.full_name
      if (d.phone !== undefined) upPatch.phone = d.phone
      if (d.is_active !== undefined) upPatch.is_active = d.is_active
      if (d.rut_body !== undefined) upPatch.rut_body = d.rut_body
      if (d.rut_dv !== undefined) upPatch.rut_dv = d.rut_dv
      if (d.profile_code !== undefined && d.profile_code.length > 0) upPatch.profile_id = nextProfileId

      if (Object.keys(upPatch).length) {
        await trx('user_profile').where({ id: platformUserProfileId }).update(upPatch)
      }

      if (nextProfileCode === 'ADMINISTRADOR_PLATAFORMA') {
        await trx('company_internal_user').where({ id: platformUserProfileId }).del()
      } else if (nextProfileCode === 'USUARIO_EMPRESA_ADMINISTRADOR') {
        const storedCiu = await trx('company_internal_user').select('company_id').where({ id: platformUserProfileId }).first()

        if (storedCiu) {
          if (d.company_id !== undefined && d.company_id !== storedCiu.company_id) {
            throw new Error('COMPANY_ID_IMMUTABLE')
          }
          if (!(await validateCompanyExists(trx, storedCiu.company_id))) throw new Error('INVALID_COMPANY_ID')
        } else {
          const cid =
            gate.access === 'company'
              ? gate.companyId
              : d.company_id !== undefined
                ? d.company_id
                : null
          if (!cid) throw new Error('MISSING_COMPANY_FOR_COMPANY_ADMIN')
          if (gate.access === 'company' && String(cid) !== String(gate.companyId)) {
            throw new Error('FORBIDDEN_COMPANY_SCOPE')
          }
          if (!(await validateCompanyAssignable(trx, cid))) throw new Error('COMPANY_NOT_ASSIGNABLE')
          await trx('company_internal_user').insert({ id: platformUserProfileId, company_id: cid })
        }
      }
    })
  } catch (e) {
    if (String(e.message) === 'COMPANY_ID_IMMUTABLE') {
      return {
        ok: false,
        status: 422,
        code: 'COMPANY_ID_IMMUTABLE',
        message: 'No se puede cambiar la empresa asignada a este usuario. El vínculo es fijo tras la creación.'
      }
    }
    if (String(e.message) === 'COMPANY_NOT_ASSIGNABLE') {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_COMPANY',
        message: 'La empresa indicada no existe o no está disponible para asignación.'
      }
    }
    if (String(e.message) === 'INVALID_COMPANY_ID') {
      return { ok: false, status: 400, code: 'INVALID_COMPANY', message: 'La empresa indicada no existe.' }
    }
    if (String(e.message) === 'MISSING_COMPANY_FOR_COMPANY_ADMIN') {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe indicar una empresa para el perfil usuario empresa administrador.'
      }
    }
    if (String(e.message) === 'FORBIDDEN_COMPANY_SCOPE') {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'Solo puede asignar usuarios a su propia empresa.'
      }
    }
    return { ok: false, status: 500, code: 'UPDATE_FAILED', message: 'No se pudo actualizar el usuario.' }
  }

  return getPlatformUserDetailForAdmin({ userId, platformUserProfileId })
}

module.exports = {
  listPlatformUsersForAdmin,
  getPlatformUserDetailForAdmin,
  createPlatformUser,
  updatePlatformUser,
  PLATFORM_PROFILE_CODES
}
