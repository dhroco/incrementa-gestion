const PROFILES = [{ code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador de plataforma' }]

exports.seed = async function seed(knex) {
  for (const p of PROFILES) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await knex('profile').where({ code: p.code }).first()
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await knex('profile').insert(p)
    }
  }
}
