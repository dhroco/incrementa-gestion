const { _gfaCompanyIds } = require('./003_gfa_company_seed')
const { _gfaClauseIds } = require('./007_gfa_clause_seed')

async function pickUniqueClauseCompanyCode(knex, { clauseId, companyId, preferredCode }) {
  // If preferred code is already used by another clause in the same company, derive a deterministic alternative.
  const base = String(preferredCode || '').trim()
  if (!base) return null

  const exists = await knex('clause_company')
    .select('id')
    .where({ company_id: companyId, code: base })
    .whereNot({ id: clauseId })
    .first()

  if (!exists) return base

  // Deterministic alternative: add suffix from clause id.
  const suffix = String(clauseId).replace(/[^a-f0-9]/gi, '').slice(0, 6) || 'ALT'
  const alt = `${base}_${suffix}`

  const existsAlt = await knex('clause_company')
    .select('id')
    .where({ company_id: companyId, code: alt })
    .whereNot({ id: clauseId })
    .first()

  if (!existsAlt) return alt
  // Last resort: let it be null (avoid breaking seed runs)
  return null
}

async function pickUniqueClauseUniversalCode(knex, { clauseId, preferredCode }) {
  const base = String(preferredCode || '').trim()
  if (!base) {
    const suffix = String(clauseId).replace(/[^a-f0-9]/gi, '').slice(0, 6) || 'ALT'
    return `CLAUSE_UNIV_${suffix}`
  }

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

  // Should be practically unreachable; keep deterministic.
  return `${base}_${suffix}_X`
}

exports.seed = async function seed(knex) {
  const { cc_parent_1, cc_parent_2, cu_parent_1, cu_parent_2, cu_parent_3, cu_parent_4 } = _gfaClauseIds

  const author = await knex('user_profile').select('id').orderBy('created_at', 'asc').first()
  const authorId = author?.id ?? null

  const ids = [cc_parent_1, cc_parent_2, cu_parent_1, cu_parent_2, cu_parent_3, cu_parent_4]

  // Company clause codes MUST match between clause and clause_company (inheritance constraint).
  // Compute final codes first, reusing any existing clause_company.code if already set.
  const ccRows = await knex('clause_company')
    .select('id', 'company_id', 'code')
    .whereIn('id', [cc_parent_1, cc_parent_2])

  /** @type {Record<string, string>} */
  const companyClauseCodeById = {}
  for (const row of ccRows) {
    if (row.code && String(row.code).trim().length > 0) {
      companyClauseCodeById[row.id] = row.code
      continue
    }
    const preferred = row.id === cc_parent_1 ? 'CLAUSE_EMP_001' : 'CLAUSE_EMP_002'
    const nextCode = await pickUniqueClauseCompanyCode(knex, {
      clauseId: row.id,
      companyId: row.company_id,
      preferredCode: preferred
    })
    if (nextCode) companyClauseCodeById[row.id] = nextCode
  }

  // Universal clause codes MUST match between clause and clause_universal.
  // Compute final codes first, reusing any existing clause_universal.code if already set.
  const cuRows = await knex('clause_universal')
    .select('id', 'code')
    .whereIn('id', [cu_parent_1, cu_parent_2, cu_parent_3, cu_parent_4])

  /** @type {Record<string, string>} */
  const universalClauseCodeById = {}
  for (const row of cuRows) {
    if (row.code && String(row.code).trim().length > 0) {
      universalClauseCodeById[row.id] = row.code
      continue
    }
    const preferred =
      row.id === cu_parent_1
        ? 'CLAUSE_UNIV_001'
        : row.id === cu_parent_2
          ? 'CLAUSE_UNIV_002'
          : row.id === cu_parent_3
            ? 'CLAUSE_UNIV_003'
            : 'CLAUSE_UNIV_004'
    const nextCode = await pickUniqueClauseUniversalCode(knex, { clauseId: row.id, preferredCode: preferred })
    if (nextCode) universalClauseCodeById[row.id] = nextCode
  }

  await knex('clause')
    .whereIn('id', ids)
    .update({
      title_clause: knex.raw(
        'CASE id WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? END',
        [
          cc_parent_1,
          'Cláusula Empresa 1',
          cc_parent_2,
          'Cláusula Empresa 2',
          cu_parent_1,
          'Cláusula Universal 1',
          cu_parent_2,
          'Cláusula Universal 2',
          cu_parent_3,
          'Cláusula Universal 3',
          cu_parent_4,
          'Cláusula Universal 4',
        ]
      ),
      code: knex.raw(
        'CASE id WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? END',
        [
          cc_parent_1,
          companyClauseCodeById[cc_parent_1] ?? 'CLAUSE_EMP_001',
          cc_parent_2,
          companyClauseCodeById[cc_parent_2] ?? 'CLAUSE_EMP_002',
          cu_parent_1,
          universalClauseCodeById[cu_parent_1] ?? 'CLAUSE_UNIV_001',
          cu_parent_2,
          universalClauseCodeById[cu_parent_2] ?? 'CLAUSE_UNIV_002',
          cu_parent_3,
          universalClauseCodeById[cu_parent_3] ?? 'CLAUSE_UNIV_003',
          cu_parent_4,
          universalClauseCodeById[cu_parent_4] ?? 'CLAUSE_UNIV_004',
        ]
      ),
      description: knex.raw(
        'CASE id WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? END',
        [
          cc_parent_1,
          'Descripción cláusula empresa 1',
          cc_parent_2,
          'Descripción cláusula empresa 2',
          cu_parent_1,
          'Descripción cláusula universal 1',
          cu_parent_2,
          'Descripción cláusula universal 2',
          cu_parent_3,
          'Descripción cláusula universal 3',
          cu_parent_4,
          'Descripción cláusula universal 4',
        ]
      ),
      status: 'draft',
      created_by: authorId,
      updated_by: authorId,
      last_edited_by: authorId,
    })

  // Update clause_company with codes
  for (const row of ccRows) {
    const nextCode = companyClauseCodeById[row.id]
    if (!nextCode) continue
    // If code differs and is already set, keep it (and clause was aligned above).
    if (row.code && row.code !== nextCode) continue
    await knex('clause_company').where({ id: row.id }).update({ code: nextCode })
  }

  // Update clause_universal with codes
  for (const row of cuRows) {
    const nextCode = universalClauseCodeById[row.id]
    if (!nextCode) continue
    if (row.code && row.code !== nextCode) continue
    await knex('clause_universal').where({ id: row.id }).update({ code: nextCode })
  }

  // Keep universal seed data compact: remove older seed-generated universal clauses beyond our 4 ids.
  const keepUniversalIds = [cu_parent_1, cu_parent_2, cu_parent_3, cu_parent_4]
  // We purposely prune *seed-like* universal clauses so dev environments stay small.
  // Match by common seed patterns: draft + no created_by OR title/code prefixes.
  const toDelete = await knex('clause_universal as cu')
    .join('clause as c', 'c.id', 'cu.id')
    .select('cu.id')
    .whereNotIn('cu.id', keepUniversalIds)
    .andWhere((w) => {
      w.where((w2) => {
        w2.where('c.status', 'draft').whereNull('c.created_by')
      })
        .orWhereILike('c.title_clause', 'Cláusula Universal%')
        .orWhereILike('c.code', 'CLAUSE_UNIV%')
        .orWhereILike('cu.code', 'CLAUSE_UNIV%')
    })

  const deleteIds = (toDelete || []).map((r) => r.id).filter(Boolean)
  if (deleteIds.length > 0) {
    await knex('clause').whereIn('id', deleteIds).del()
  }

  // Add sample content with TipTap JSON structure
  const sampleContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Esta es una cláusula de ejemplo con contenido enriquecido. '
          },
          {
            type: 'variable',
            attrs: {
              variableId: 'worker_name',
              label: 'Nombre Trabajador',
              group: 'trabajador'
            }
          },
          {
            type: 'text',
            text: ' está sujeto a las condiciones establecidas.'
          }
        ]
      }
    ]
  }

  await knex('clause')
    .where('id', cu_parent_1)
    .update({
      content_json: sampleContent
    })
}
