const { randomUUID } = require('node:crypto')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { SEED_ALLOWLIST_EMAILS_RAW } = require('../lib/seedAllowlistEmail')

/** UUID legado de demo (si existe en auth, se mantiene perfil USUARIO_EMPRESA_ADMINISTRADOR). */
const LEGACY_COMPANY_ADMIN_USER_ID = 'fa0b01cf-9076-41d7-8df2-70c013083861'

async function ensureProfilesExist(knex) {
  await knex('profile')
    .insert([
      { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador Plataforma' },
      { code: 'USUARIO_EMPRESA_ADMINISTRADOR', label: 'Usuario Empresa Administrador' },
      { code: 'CONTADOR', label: 'Contador' },
    ])
    .onConflict('code')
    .ignore()

  const rows = await knex('profile').select('id', 'code').whereIn('code', [
    'ADMINISTRADOR_PLATAFORMA',
    'USUARIO_EMPRESA_ADMINISTRADOR',
    'CONTADOR',
  ])

  const byCode = new Map(rows.map((r) => [r.code, r.id]))
  const adminId = byCode.get('ADMINISTRADOR_PLATAFORMA')
  const companyAdminId = byCode.get('USUARIO_EMPRESA_ADMINISTRADOR')
  const accountantId = byCode.get('CONTADOR')

  if (!adminId || !companyAdminId || !accountantId) {
    throw new Error('Missing required profiles after ensureProfilesExist; expected three profile codes to exist.')
  }

  return { adminId, companyAdminId, accountantId }
}

exports.seed = async function seed(knex) {
  // No inserta en company_internal_user / accountant / accountant_company (ver comentarios previos + seed 012).
  const { adminId, companyAdminId } = await ensureProfilesExist(knex)

  const legacy = await knex.withSchema('auth').select('id').from('users').where({ id: LEGACY_COMPANY_ADMIN_USER_ID }).first()

  const allowEmails = Array.from(
    new Set(
      (SEED_ALLOWLIST_EMAILS_RAW || [])
        .map((e) => normalizeAuthEmail(e))
        .filter((e) => typeof e === 'string' && e.length > 0)
    )
  )
  let byAllowlistEmail = null
  if (allowEmails.length > 0) {
    byAllowlistEmail = await knex
      .withSchema('auth')
      .select('id')
      .from('users')
      .whereRaw(
        `lower(trim(email::text)) in (${allowEmails.map(() => '?').join(',')})`,
        allowEmails
      )
      .first()
  }

  const target = legacy ?? byAllowlistEmail
  if (!target?.id) {
    throw new Error(
      [
        'Seed 010: no hay fila en auth.users usable.',
        `Crea el usuario legado (id ${LEGACY_COMPANY_ADMIN_USER_ID}) o un usuario con correo en allowlist [${allowEmails.join(', ')}], luego: npm run seed:run`,
      ].join(' ')
    )
  }

  const userId = target.id
  const profileId = legacy ? companyAdminId : adminId

  const existingUp = await knex('user_profile').select('id').where({ user_id: userId }).first()
  const upId = existingUp?.id ?? randomUUID()

  if (!existingUp) {
    await knex('user_profile').insert({ id: upId, user_id: userId, profile_id: profileId })
  } else {
    await knex('user_profile').where({ id: upId }).update({ profile_id: profileId })
  }
}
