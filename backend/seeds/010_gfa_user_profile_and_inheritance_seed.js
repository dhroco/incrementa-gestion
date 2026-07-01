/**
 * Seed de perfiles y asignación de usuarios de prueba.
 * Los user_id corresponden a los UUID (claim "sub") de usuarios en Microsoft Entra.
 *
 * Usuarios de prueba:
 *   admin@incrementa.la      → ADMINISTRADOR_PLATAFORMA  (d91840bb-206c-4cc0-8de3-2ca93e361524)
 */

const SEED_USERS = [
  { email: 'admin@incrementa.la', userId: 'd91840bb-206c-4cc0-8de3-2ca93e361524', profileCode: 'ADMINISTRADOR_PLATAFORMA' }
]

exports.seed = async function seed(knex) {
  await knex('profile')
    .insert([{ code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador Plataforma' }])
    .onConflict('code')
    .ignore()

  const profileRows = await knex('profile').select('id', 'code')
  const byCode = new Map(profileRows.map((r) => [r.code, r.id]))

  for (const { userId, profileCode } of SEED_USERS) {
    const profileId = byCode.get(profileCode)
    if (!profileId) throw new Error(`Profile not found: ${profileCode}`)

    const existing = await knex('user_profile').select('id').where({ user_id: userId }).first()
    if (!existing) {
      await knex('user_profile').insert({ user_id: userId, profile_id: profileId })
    } else {
      await knex('user_profile').where({ user_id: userId }).update({ profile_id: profileId })
    }
  }
}
