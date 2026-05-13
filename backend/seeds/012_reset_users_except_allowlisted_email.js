/**
 * DESTRUCTIVO — solo entornos controlados (p. ej. local/dev) y con backup de BD.
 *
 * Objetivo: conservar en `auth.users` a los usuarios cuyo correo esté en el allowlist
 * (`lib/seedAllowlistEmail.js`) y alinear `public.user_profile` eliminando perfiles de los demás.
 *
 * Esquema relevante (migraciones del repo):
 * - `user_profile.user_id` → `auth.users.id` (FK)
 * - `accountant.id` / `company_internal_user.id` → `user_profile.id` (ON DELETE CASCADE)
 * - `accountant_company` → `accountant` (ON DELETE CASCADE)
 * - `clause.created_by|updated_by|last_edited_by` → `user_profile.id` (ON DELETE SET NULL)
 *
 * Orden efectivo aquí:
 * 1) Tablas `auth.*` que referencian `auth.users` (varían por versión Supabase): se intentan
 *    borrados comunes antes de `auth.users`; se ignoran tablas o columnas inexistentes (42P01/42703).
 * 2) `public.user_profile` donde `user_id` no es el usuario conservado (CASCADE limpia
 *    accountant / company_internal_user; SET NULL en columnas de clause).
 * 3) `auth.users` cuyo `id` no esté entre los conservados (todos los correos allowlist presentes en Auth).
 * 4) Vaciar siempre `accountant_company`, `accountant` y `company_internal_user`: el allowlist
 *    no forza roles GFA; no deben quedar filas de extensión de esos tipos.
 *
 * Ejecución solo de este seed (desde el directorio `backend`):
 *   npx knex seed:run --specific=012_reset_users_except_allowlisted_email.js
 *
 * No ejecutar `npm run seed:run` sin revisar: corre todos los seeds y puede sobrescribir datos.
 *
 * Verificación manual sugerida tras ejecutar:
 *   select count(*) from auth.users;
 *   select count(*) from public.user_profile;
 *   select count(*) from public.accountant_company;  -- esperado 0
 *   select count(*) from public.accountant;          -- esperado 0
 *   select count(*) from public.company_internal_user; -- esperado 0
 *   (y comprobar login con el correo allowlist en la app).
 */

const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { SEED_ALLOWLIST_EMAILS_RAW } = require('../lib/seedAllowlistEmail')

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  const keepEmails = Array.from(
    new Set(
      (SEED_ALLOWLIST_EMAILS_RAW || [])
        .map((e) => normalizeAuthEmail(e))
        .filter((e) => typeof e === 'string' && e.length > 0)
    )
  )

  const keepers =
    keepEmails.length > 0
      ? await knex
          .withSchema('auth')
          .from('users')
          .select('id', 'email')
          .whereRaw(
            `lower(trim(email::text)) in (${keepEmails.map(() => '?').join(',')})`,
            keepEmails
          )
      : []

  if (!keepers || keepers.length === 0) {
    throw new Error(
      [
        'No se puede ejecutar el seed de limpieza de usuarios: no existe ningún registro en auth.users',
        `con correo en allowlist [${keepEmails.join(', ')}].`,
        'Crea o restaura al menos un usuario en Supabase Auth antes de volver a ejecutar este seed.',
      ].join(' ')
    )
  }

  const keeperIds = new Set(keepers.map((r) => r.id))

  const others = await knex
    .withSchema('auth')
    .from('users')
    .select('id')
    .whereNotIn('id', [...keeperIds])
  const otherIds = others.map((r) => r.id)

  const profileRowsToDelete = await knex('user_profile')
    .whereNotIn('user_id', [...keeperIds])
    .count('* as c')
    .first()
  const profileCountEstimate = Number(profileRowsToDelete?.c ?? 0)

  const keepEmailsLabel = keepers
    .map((r) => (r && r.email != null ? String(r.email).trim() : ''))
    .filter(Boolean)
    .join(', ')

  await knex.transaction(async (trx) => {
    if (otherIds.length) {
      await deleteAuthDependentsForUsers(trx, otherIds)

      const delProfiles = await trx('user_profile').whereNotIn('user_id', [...keeperIds]).del()
      const delUsers = await trx
        .withSchema('auth')
        .from('users')
        .whereNotIn('id', [...keeperIds])
        .del()

      const { ac, a, ciu } = await clearGfaRoleExtensionTables(trx)

      // eslint-disable-next-line no-console -- seed operativo
      console.log(
        `[012_reset_users_except_allowlisted_email] Completado. Conservado(s): ${keepEmailsLabel}. ` +
          `Eliminados: user_profile=${delProfiles} (aprox. previo ${profileCountEstimate}), auth.users=${delUsers}; ` +
          `extensiones GFA: accountant_company=${ac}, accountant=${a}, company_internal_user=${ciu}.`
      )
    } else {
      const { ac, a, ciu } = await clearGfaRoleExtensionTables(trx)
      // eslint-disable-next-line no-console -- seed operativo
      console.log(
        `[012_reset_users_except_allowlisted_email] Sin otros auth.users que borrar (${keepEmailsLabel}). ` +
          `Extensiones GFA vaciadas: accountant_company=${ac}, accountant=${a}, company_internal_user=${ciu}.`
      )
    }
  })
}

/**
 * El allowlist no es Contador ni Usuario empresa; no deben quedar filas en tablas de extensión GFA.
 *
 * @param {import('knex').Knex.Transaction} trx
 * @returns {Promise<{ ac: number, a: number, ciu: number }>}
 */
async function clearGfaRoleExtensionTables(trx) {
  const ac = await trx('accountant_company').del()
  const a = await trx('accountant').del()
  const ciu = await trx('company_internal_user').del()
  return { ac, a, ciu }
}

/**
 * Intenta vaciar filas en `auth` que impiden borrar `auth.users` en instancias Supabase típicas.
 *
 * @param {import('knex').Knex.Transaction} trx
 * @param {string[]} userIds
 */
async function deleteAuthDependentsForUsers(trx, userIds) {
  if (!userIds.length) return

  const delWhereUser = async (table) => {
    try {
      return await trx.withSchema('auth').from(table).whereIn('user_id', userIds).del()
    } catch (err) {
      if (err && typeof err === 'object' && (err.code === '42P01' || err.code === '42703')) return 0
      throw err
    }
  }

  await delWhereUser('oauth_authorizations')
  await delWhereUser('oauth_consents')
  await delWhereUser('one_time_tokens')
  await delWhereUser('flow_state')

  const sessionIdsForUsers = () => trx.withSchema('auth').select('id').from('sessions').whereIn('user_id', userIds)

  try {
    await trx.withSchema('auth').from('mfa_amr_claims').whereIn('session_id', sessionIdsForUsers()).del()
  } catch (err) {
    if (err && typeof err === 'object' && (err.code === '42P01' || err.code === '42703')) {
      // tabla o columna no presente en esta versión
    } else {
      throw err
    }
  }

  try {
    await trx.withSchema('auth').from('refresh_tokens').whereIn('session_id', sessionIdsForUsers()).del()
  } catch (err) {
    if (err && typeof err === 'object' && (err.code === '42P01' || err.code === '42703')) {
      // sin session_id o sin tabla
    } else {
      throw err
    }
  }

  await delWhereUser('refresh_tokens')
  await delWhereUser('sessions')
  await delWhereUser('identities')
}
