const { _gfaTemplateIds } = require('./006_gfa_template_seed')
const { _gfaClauseIds } = require('./007_gfa_clause_seed')

exports.seed = async function seed(knex) {
  const hasTable = await knex.schema.hasTable('template_clause')
  if (!hasTable) return
  const { tc_parent_1, tc_parent_2, ts_parent_1, ts_parent_2, ts_parent_3 } = _gfaTemplateIds
  const { cc_parent_1, cc_parent_2, cu_parent_1, cu_parent_2, cu_parent_3, cu_parent_4 } = _gfaClauseIds

  await knex('template_clause')
    .insert([
      { template_id: tc_parent_1, clause_id: cc_parent_1 },
      { template_id: tc_parent_1, clause_id: cu_parent_1 },
      { template_id: tc_parent_2, clause_id: cc_parent_2 },
      { template_id: tc_parent_2, clause_id: cu_parent_2 },
      { template_id: ts_parent_1, clause_id: cu_parent_1 },
      { template_id: ts_parent_2, clause_id: cu_parent_2 },
      { template_id: ts_parent_3, clause_id: cu_parent_3 },
      { template_id: ts_parent_1, clause_id: cu_parent_4 },
    ])
    .onConflict(['template_id', 'clause_id'])
    .ignore()
}
