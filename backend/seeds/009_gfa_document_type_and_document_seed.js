const { randomUUID } = require('node:crypto')
const { _gfaCompanyIds } = require('./003_gfa_company_seed')
const { _gfaEmployeeIds } = require('./005_gfa_employee_seed')
const { _gfaDocumentTypeIds, _gfaTemplateIds } = require('./006_gfa_template_seed')

exports._gfaDocumentIds = {
  d1: randomUUID(),
  d2: randomUUID(),
}

exports.seed = async function seed(knex) {
  const { tdt1: dt1, tdt2: dt2 } = _gfaDocumentTypeIds
  const { d1, d2 } = exports._gfaDocumentIds
  const { c1, c2 } = _gfaCompanyIds
  const { e1, e2 } = _gfaEmployeeIds
  const { tc_parent_1, ts_parent_1 } = _gfaTemplateIds

  await knex('document')
    .insert([
      { id: d1, template_id: tc_parent_1, company_id: c1, employee_id: e1, document_type_id: dt1 },
      { id: d2, template_id: ts_parent_1, company_id: c2, employee_id: e2, document_type_id: dt2 },
    ])
    .onConflict('id')
    .ignore()
}

