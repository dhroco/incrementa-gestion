const { randomUUID } = require('node:crypto')

// IMPORTANT:
// These IDs must be stable across a seed run because other seeds depend on them.
// However, the seed must also be re-runnable across environments where the same RUT
// may have been inserted previously with a different UUID.
//
// Strategy:
// - Look up company ids by canonical RUT.
// - Insert only if missing (using a generated UUID).
// - Mutate this shared object so downstream seeds (which import it) see the resolved ids.
exports._gfaCompanyIds = { c1: null, c2: null }

exports.seed = async function seed(knex) {
  const c1Rut = { rut_body: '76543210', rut_dv: '3' }
  const c2Rut = { rut_body: '11111111', rut_dv: '1' }

  const existing = await knex('company')
    .select('id', 'rut_body', 'rut_dv')
    .whereIn('rut_body', [c1Rut.rut_body, c2Rut.rut_body])

  const byRut = new Map(existing.map((r) => [`${r.rut_body}-${String(r.rut_dv || '').toUpperCase()}`, r.id]))

  const c1 = byRut.get(`${c1Rut.rut_body}-${c1Rut.rut_dv}`) ?? randomUUID()
  const c2 = byRut.get(`${c2Rut.rut_body}-${c2Rut.rut_dv}`) ?? randomUUID()

  exports._gfaCompanyIds.c1 = c1
  exports._gfaCompanyIds.c2 = c2

  await knex('company')
    .insert([
      {
        id: c1,
        business_name: 'Empresa Demo Uno SpA',
        rut_body: c1Rut.rut_body,
        rut_dv: c1Rut.rut_dv,
        business_activity: 'Servicios de consultoría',
        address: 'Av. Providencia 1234',
        commune: 'Providencia',
        city: 'Santiago',
        region: 'Región Metropolitana',
        email: 'contacto@demo-uno.cl',
        phone: '+56 9 1111 1111',
        name_legal_representative_1: 'Representante Uno',
        rut_body_legal_representative_1: '12345678',
        rut_dv_legal_representative_1: '5',
        name_legal_representative_2: 'Representante Dos',
        rut_body_legal_representative_2: '10000000',
        rut_dv_legal_representative_2: '8'
      },
      {
        id: c2,
        business_name: 'Empresa Demo Dos Ltda.',
        rut_body: c2Rut.rut_body,
        rut_dv: c2Rut.rut_dv,
        business_activity: 'Comercialización',
        address: 'Los Leones 456',
        commune: 'Las Condes',
        city: 'Santiago',
        region: 'Región Metropolitana',
        email: 'contacto@demo-dos.cl',
        phone: '+56 2 2222 2222',
        name_legal_representative_1: 'Representante A',
        rut_body_legal_representative_1: '87654321',
        rut_dv_legal_representative_1: '4',
        name_legal_representative_2: null,
        rut_body_legal_representative_2: null,
        rut_dv_legal_representative_2: null
      }
    ])
    .onConflict('id')
    .merge()

  const hasBranchTable = await knex.schema.hasTable('company_branch')
  if (hasBranchTable) {
    await knex('company_branch').whereIn('company_id', [c1, c2]).del()
    await knex('company_branch').insert([
      {
        company_id: c1,
        name: 'Casa Matriz',
        address: 'Av. Providencia 1234',
        commune: 'Providencia',
        city: 'Santiago',
        region: 'Región Metropolitana',
        email: 'sucursal.centro@demo-uno.cl',
        phone: '+56 2 2000 0001',
        sort_order: 0
      },
      {
        company_id: c1,
        name: 'Sucursal Norte',
        address: 'Av. Chicureo 200',
        commune: 'Colina',
        city: 'Colina',
        region: 'Región Metropolitana',
        email: 'sucursal.norte@demo-uno.cl',
        phone: '+56 2 2000 0002',
        sort_order: 1
      },
      {
        company_id: c2,
        name: 'Oficina Central',
        address: 'Los Leones 456',
        commune: 'Las Condes',
        city: 'Santiago',
        region: 'Región Metropolitana',
        email: 'oficina@demo-dos.cl',
        phone: '+56 2 2222 2223',
        sort_order: 0
      }
    ])
  }

  // Optional pruning: keep only the two demo companies and delete others + dependents.
  // IMPORTANT: This is a development helper. Enable explicitly via env var.
  const prune = String(process.env.GFA_SEED_PRUNE_COMPANIES || '').trim() === '1'
  if (prune) {
    const keepIds = [c1, c2].filter(Boolean)

    await knex.transaction(async (trx) => {
      // Delete RESTRICT dependencies first.
      await trx('document').whereNotIn('company_id', keepIds).del()

      // Clean direct references (most are CASCADE on company delete, but we clean explicitly).
      if (await trx.schema.hasTable('company_branch')) {
        await trx('company_branch').whereNotIn('company_id', keepIds).del()
      }
      await trx('accountant_company').whereNotIn('company_id', keepIds).del()
      await trx('company_internal_user').whereNotIn('company_id', keepIds).del()
      await trx('template_company').whereNotIn('company_id', keepIds).del()

      // Company-scoped clauses (CASCADE on company delete, but safe to delete explicitly).
      await trx('clause_company').whereNotIn('company_id', keepIds).del()

      // Finally delete companies not in keepIds (CASCADE will remove position/work_schedule/employee, etc.).
      await trx('company').whereNotIn('id', keepIds).del()
    })
  }
}

