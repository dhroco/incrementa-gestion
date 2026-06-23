/**
 * Idempotent CASL rules for ADMINISTRADOR_PLATAFORMA: manage/all.
 */
exports.seed = async function (knex) {
  const profile = await knex('profile').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()
  if (!profile) return

  const existing = await knex('role_permissions')
    .where({ role_id: profile.id, action: 'manage', subject: 'all', inverted: false })
    .first()

  if (!existing) {
    await knex('role_permissions').insert({
      role_id: profile.id,
      action: 'manage',
      subject: 'all',
      inverted: false
    })
  }
}
