const { randomUUID } = require('node:crypto')
const { _gfaCompanyIds } = require('./003_gfa_company_seed')

exports._gfaPositionIds = {
  p1: randomUUID(),
  p2: randomUUID(),
}

exports._gfaWorkScheduleIds = {
  w1: randomUUID(),
  w2: randomUUID(),
}

exports.seed = async function seed(knex) {
  const { c1, c2 } = _gfaCompanyIds
  const { p1, p2 } = exports._gfaPositionIds
  const { w1, w2 } = exports._gfaWorkScheduleIds

  await knex('position')
    .insert([
      {
        id: p1,
        company_id: c1,
        name: 'Analista contable',
        description: 'Apoyo en contabilidad y reportes'
      },
      {
        id: p2,
        company_id: c2,
        name: 'Operario de bodega',
        description: 'Recepción, almacenaje y despacho'
      }
    ])
    .onConflict('id')
    .merge({
      name: knex.raw('excluded.name'),
      description: knex.raw('excluded.description')
    })

  await knex('work_schedule')
    .insert([
      { id: w1, company_id: c1, name: 'Jornada completa 40h' },
      { id: w2, company_id: c2, name: 'Media jornada' },
    ])
    .onConflict('id')
    .merge({ name: knex.raw('excluded.name') })
}

