const { _gfaCompanyIds } = require('./003_gfa_company_seed')

async function pickUniqueUniversalCode(knex, { clauseId, preferredCode }) {
  const base = String(preferredCode || '').trim()
  if (!base) return `CLAUSE_UNIV_${String(clauseId).replace(/[^a-f0-9]/gi, '').slice(0, 6) || 'ALT'}`

  const exists = await knex('clause_universal')
    .select('id')
    .where({ code: base })
    .whereNot({ id: clauseId })
    .first()

  if (!exists) return base

  const suffix = String(clauseId).replace(/[^a-f0-9]/gi, '').slice(0, 6) || 'ALT'
  for (let i = 0; i < 50; i += 1) {
    const alt = i === 0 ? `${base}_${suffix}` : `${base}_${suffix}_${i}`
    const existsAlt = await knex('clause_universal')
      .select('id')
      .where({ code: alt })
      .whereNot({ id: clauseId })
      .first()
    if (!existsAlt) return alt
  }
  return `${base}_${suffix}_X`
}

exports._gfaClauseIds = {
  // parents for company clauses
  cc_parent_1: '70000000-0000-4000-8000-000000000001',
  cc_parent_2: '70000000-0000-4000-8000-000000000002',
  // parents for universal clauses
  cu_parent_1: '70000000-0000-4000-8000-000000000101',
  cu_parent_2: '70000000-0000-4000-8000-000000000102',
  cu_parent_3: '70000000-0000-4000-8000-000000000103',
  cu_parent_4: '70000000-0000-4000-8000-000000000104',
}

/** Contextual codes for company clauses (unique per company_id; required since clause_company.code is NOT NULL). */
const companyClauseCodesById = {
  '70000000-0000-4000-8000-000000000001': 'GFA_SEED_CC_C1_001',
  '70000000-0000-4000-8000-000000000002': 'GFA_SEED_CC_C2_001',
}

exports.seed = async function seed(knex) {
  const { c1, c2 } = _gfaCompanyIds
  const { cc_parent_1, cc_parent_2, cu_parent_1, cu_parent_2, cu_parent_3, cu_parent_4 } = exports._gfaClauseIds
  const desiredCodes = {
    [cu_parent_1]: await pickUniqueUniversalCode(knex, { clauseId: cu_parent_1, preferredCode: 'CLAUSE_UNIV_001' }),
    [cu_parent_2]: await pickUniqueUniversalCode(knex, { clauseId: cu_parent_2, preferredCode: 'CLAUSE_UNIV_002' }),
    [cu_parent_3]: await pickUniqueUniversalCode(knex, { clauseId: cu_parent_3, preferredCode: 'CLAUSE_UNIV_003' }),
    [cu_parent_4]: await pickUniqueUniversalCode(knex, { clauseId: cu_parent_4, preferredCode: 'CLAUSE_UNIV_004' }),
  }

  await knex.transaction(async (trx) => {
    await trx('clause')
      .insert([
        { id: cc_parent_1, code: companyClauseCodesById[cc_parent_1] },
        { id: cc_parent_2, code: companyClauseCodesById[cc_parent_2] },
        { id: cu_parent_1, code: desiredCodes[cu_parent_1] },
        { id: cu_parent_2, code: desiredCodes[cu_parent_2] },
        { id: cu_parent_3, code: desiredCodes[cu_parent_3] },
        { id: cu_parent_4, code: desiredCodes[cu_parent_4] },
      ])
      .onConflict('id')
      .merge()

    await trx('clause_company')
      .insert([
        { id: cc_parent_1, company_id: c1, code: companyClauseCodesById[cc_parent_1] },
        { id: cc_parent_2, company_id: c2, code: companyClauseCodesById[cc_parent_2] },
      ])
      .onConflict('id')
      .ignore()

    await trx('clause_universal')
      .insert([
        { id: cu_parent_1, code: desiredCodes[cu_parent_1] },
        { id: cu_parent_2, code: desiredCodes[cu_parent_2] },
        { id: cu_parent_3, code: desiredCodes[cu_parent_3] },
        { id: cu_parent_4, code: desiredCodes[cu_parent_4] },
      ])
      .onConflict('id')
      .merge()
  })
}

