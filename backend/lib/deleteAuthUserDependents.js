/**
 * Borra filas en `auth.*` que suelen impedir eliminar `auth.users` en Supabase.
 * Copiado/centralizado desde scripts de limpieza de usuario (misma semántica que seed 012).
 *
 * @param {import('knex').Knex.Transaction} trx
 * @param {string[]} userIds - auth.users.id
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
    if (!(err && typeof err === 'object' && (err.code === '42P01' || err.code === '42703'))) throw err
  }

  try {
    await trx.withSchema('auth').from('refresh_tokens').whereIn('session_id', sessionIdsForUsers()).del()
  } catch (err) {
    if (!(err && typeof err === 'object' && (err.code === '42P01' || err.code === '42703'))) throw err
  }

  await delWhereUser('refresh_tokens')
  await delWhereUser('sessions')
  await delWhereUser('identities')
}

module.exports = { deleteAuthDependentsForUsers }
