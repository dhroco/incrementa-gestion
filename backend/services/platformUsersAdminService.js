const { db } = require('../db/knex')

const { isValidEmail } = require('../utils/validation')

const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')

const { getKeycloakAdminClient } = require('../lib/keycloakAdminClient')



const ADMIN_CLIENT_UNAVAILABLE_MSG =

  'El aprovisionamiento de usuarios no está configurado (falta KEYCLOAK_ADMIN_PASSWORD o configuración de Keycloak Admin).'



const IDP_USER_NOT_FOUND_MSG =

  'El usuario con ese email no existe en el servidor de autenticación. Créalo primero en Keycloak.'



const IDP_LOOKUP_FAILED_MSG =

  'No se pudo consultar el servidor de autenticación. Intente nuevamente más tarde.'



async function getProfileIdByCode(trx, code) {

  const row = await trx('profile').select('id').where({ code }).first()

  return row?.id ?? null

}



function validateCreatePayload(body) {

  const email = normalizeAuthEmail(body?.email)

  const profileCode =

    typeof body?.profile_code === 'string'

      ? body.profile_code.trim()

      : typeof body?.profileCode === 'string'

        ? body.profileCode.trim()

        : ''



  const errors = []

  if (!email) errors.push('El correo es obligatorio.')

  else if (!isValidEmail(email)) errors.push('El correo no tiene un formato válido.')

  if (!profileCode) {

    errors.push('Debe seleccionar un rol válido.')

  }



  let is_active = true

  if (body?.is_active !== undefined) is_active = !!body.is_active

  else if (body?.isActive !== undefined) is_active = !!body.isActive



  if (errors.length) return { ok: false, errors }

  return {

    ok: true,

    data: {

      email,

      profile_code: profileCode,

      is_active

    }

  }

}



function validateUpdatePayload(body) {

  const errors = []



  const email = body?.email !== undefined ? normalizeAuthEmail(body.email) : undefined

  if (body?.email !== undefined && !email) errors.push('El correo no tiene un formato válido.')

  else if (email && !isValidEmail(email)) errors.push('El correo no tiene un formato válido.')



  let is_active

  if (body?.is_active !== undefined) is_active = !!body.is_active

  else if (body?.isActive !== undefined) is_active = !!body.isActive



  const profileCode =

    body?.profile_code !== undefined

      ? String(body.profile_code || '').trim()

      : body?.profileCode !== undefined

        ? String(body.profileCode || '').trim()

        : undefined



  if (profileCode !== undefined && profileCode.length === 0) {

    errors.push('Debe seleccionar un rol válido.')

  }



  if (errors.length) return { ok: false, errors }

  return {

    ok: true,

    data: {

      email,

      is_active,

      profile_code: profileCode === '' ? undefined : profileCode

    }

  }

}



async function listPlatformUsersForAdmin({ userId, q = '' }) {

  const qb = db('user_profile as up')

    .join('profile as p', 'p.id', 'up.profile_id')

    .select(

      'up.id',

      'up.email',

      'up.full_name',

      'up.is_active',

      'p.code as profile_code',

      'p.label as profile_label',

      'up.updated_at'

    )



  const term = String(q || '').trim()

  if (term.length > 0) {

    const t = `%${term}%`

    qb.andWhere((w) => {

      w.whereILike('up.email', t).orWhereILike('up.full_name', t)

    })

  }



  const items = await qb.orderBy('up.email', 'asc')

  return { ok: true, data: { items } }

}



async function getPlatformUserDetailForAdmin({ userId, platformUserProfileId }) {

  const row = await db('user_profile as up')

    .join('profile as p', 'p.id', 'up.profile_id')

    .select(

      'up.id',

      'up.email',

      'up.full_name',

      'up.is_active',

      'p.code as profile_code',

      'p.label as profile_label'

    )

    .where('up.id', platformUserProfileId)

    .first()



  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Usuario no encontrado.' }



  return {

    ok: true,

    data: {

      user: {

        id: row.id,

        email: row.email,

        full_name: row.full_name,

        is_active: row.is_active,

        profile_code: row.profile_code,

        profile_label: row.profile_label

      }

    }

  }

}



async function createPlatformUser({ userId, payload }) {

  const v = validateCreatePayload(payload)

  if (!v.ok) {

    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }

  }

  const { email, profile_code, is_active } = v.data



  const kc = getKeycloakAdminClient()

  if (!kc) {

    return {

      ok: false,

      status: 503,

      code: 'ADMIN_CLIENT_UNAVAILABLE',

      message: ADMIN_CLIENT_UNAVAILABLE_MSG

    }

  }



  const existingProfile = await db('user_profile').select('id').where({ email }).first()

  if (existingProfile) {

    return {

      ok: false,

      status: 409,

      code: 'DUPLICATE',

      message: 'El usuario ya está registrado en el sistema.'

    }

  }



  let keycloakUser

  try {

    keycloakUser = await kc.findUserIdByEmail(email)

  } catch (err) {

    return {

      ok: false,

      status: 503,

      code: 'ADMIN_CLIENT_UNAVAILABLE',

      message: IDP_LOOKUP_FAILED_MSG

    }

  }



  if (!keycloakUser?.id) {

    return {

      ok: false,

      status: 422,

      code: 'IDP_USER_NOT_FOUND',

      message: IDP_USER_NOT_FOUND_MSG

    }

  }



  const existingByKeycloakId = await db('user_profile').select('id').where({ user_id: keycloakUser.id }).first()

  if (existingByKeycloakId) {

    return {

      ok: false,

      status: 409,

      code: 'DUPLICATE',

      message: 'El usuario ya está registrado en el sistema.'

    }

  }



  /** @type {string | null} */

  let newUserProfileId = null



  try {

    await db.transaction(async (trx) => {

      const profileId = await getProfileIdByCode(trx, profile_code)

      if (!profileId) throw new Error('MISSING_TARGET_PROFILE')



      const insertedRows = await trx('user_profile')

        .insert({

          user_id: keycloakUser.id,

          profile_id: profileId,

          email,

          full_name: keycloakUser.fullName,

          is_active: !!is_active

        })

        .returning('id')



      const upId = insertedRows?.[0]?.id

      if (!upId) throw new Error('USER_PROFILE_INSERT_FAILED')

      newUserProfileId = upId

    })

  } catch (e) {

    if (String(e.message) === 'MISSING_TARGET_PROFILE') {

      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Debe seleccionar un rol válido.' }

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

    data: full.data

  }

}



async function updatePlatformUser({ userId, platformUserProfileId, payload }) {

  const v = validateUpdatePayload(payload)

  if (!v.ok) {

    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors.join(' '), errors: v.errors }

  }



  const existing = await db('user_profile as up')

    .join('profile as p', 'p.id', 'up.profile_id')

    .select('up.id', 'up.user_id', 'p.code as profile_code')

    .where('up.id', platformUserProfileId)

    .first()



  if (!existing) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Usuario no encontrado.' }



  const kc = getKeycloakAdminClient()

  const d = v.data



  if (d.email !== undefined && d.email !== null) {

    if (!kc) {

      return {

        ok: false,

        status: 503,

        code: 'ADMIN_CLIENT_UNAVAILABLE',

        message: 'Actualización de correo no está configurada en el servidor (Keycloak Admin).'

      }

    }

    try {

      await kc.updateUserEmail(existing.user_id, d.email)

    } catch (err) {

      return {

        ok: false,

        status: 422,

        code: 'AUTH_UPDATE_FAILED',

        message: err?.message || 'No se pudo actualizar el correo en el servicio de autenticación.'

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

      if (d.email !== undefined && d.email !== null) upPatch.email = d.email

      if (d.is_active !== undefined) upPatch.is_active = d.is_active

      if (d.profile_code !== undefined && d.profile_code.length > 0) upPatch.profile_id = nextProfileId



      if (Object.keys(upPatch).length) {

        await trx('user_profile').where({ id: platformUserProfileId }).update(upPatch)

      }

    })

  } catch (e) {

    if (String(e.message) === 'MISSING_TARGET_PROFILE') {

      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Debe seleccionar un rol válido.' }

    }

    return { ok: false, status: 500, code: 'UPDATE_FAILED', message: 'No se pudo actualizar el usuario.' }

  }



  return getPlatformUserDetailForAdmin({ userId, platformUserProfileId })

}



async function listAssignableRolesForAdmin({ userId }) {

  const items = await db('profile').select('code', 'label').orderBy('label', 'asc')

  return { ok: true, data: { items } }

}



module.exports = {

  listPlatformUsersForAdmin,

  getPlatformUserDetailForAdmin,

  createPlatformUser,

  updatePlatformUser,

  listAssignableRolesForAdmin

}

