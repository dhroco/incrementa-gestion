const PROFILES = [
  { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador de plataforma' },
  { code: 'USUARIO_EMPRESA_ADMINISTRADOR', label: 'Usuario empresa (administrador)' },
  { code: 'CONTADOR', label: 'Contador' }
]

exports.seed = async function seed(knex) {
  for (const p of PROFILES) {
    // idempotent insert
    // eslint-disable-next-line no-await-in-loop
    const exists = await knex('profile').where({ code: p.code }).first()
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await knex('profile').insert(p)
    }
  }
}

