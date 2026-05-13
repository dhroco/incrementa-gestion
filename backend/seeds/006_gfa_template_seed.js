const { _gfaCompanyIds } = require('./003_gfa_company_seed')

/**
 * IDs fijos (no `randomUUID()` al cargar el módulo): en cada `knex seed:run` se insertan
 * las mismas filas y `onConflict('id').ignore()` evita duplicar por id.
 * El índice único `idx_template_standard_code_lower` aplica a `code`; sin IDs fijos,
 * una segunda ejecución generaba UUIDs distintos con los mismos códigos y fallaba el insert.
 */
exports._gfaDocumentTypeIds = {
  tdt1: 'a1000000-0000-4000-8000-000000000001',
  tdt2: 'a1000000-0000-4000-8000-000000000002',
}

exports._gfaTemplateIds = {
  tc_parent_1: 'a2000000-0000-4000-8000-000000000001',
  tc_parent_2: 'a2000000-0000-4000-8000-000000000002',
  ts_parent_1: 'a2000000-0000-4000-8000-000000000010',
  ts_parent_2: 'a2000000-0000-4000-8000-000000000011',
  ts_parent_3: 'a2000000-0000-4000-8000-000000000012',
}

const GFA_SEED_STD_CODES = ['PLANTILLA-SEED-01', 'PLANTILLA-SEED-02', 'PLANTILLA-SEED-03']
const GFA_SEED_EMP_COMPANY_CODES = ['EMP-PLANT-001', 'EMP-PLANT-002']

const MIN_TEMPLATE_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

exports.seed = async function seed(knex) {
  const { tdt1, tdt2 } = exports._gfaDocumentTypeIds
  const { tc_parent_1, tc_parent_2, ts_parent_1, ts_parent_2, ts_parent_3 } = exports._gfaTemplateIds
  const { c1, c2 } = _gfaCompanyIds

  // Quitar sobras de ejecuciones antiguas (UUIDs distintos, mismos códigos) para poder re-seed.
  const byStd = await knex('template').pluck('id').whereIn('code', GFA_SEED_STD_CODES)
  const byEmp = await knex('template_company').pluck('id').whereIn('code', GFA_SEED_EMP_COMPANY_CODES)
  const toRemove = [...new Set([...byStd, ...byEmp])]
  if (toRemove.length) {
    if (await knex.schema.hasTable('template_clause')) {
      await knex('template_clause').whereIn('template_id', toRemove).del()
    }
    if (await knex.schema.hasTable('document')) {
      const hasCol = await knex.schema.hasColumn('document', 'template_id')
      if (hasCol) {
        await knex('document').whereIn('template_id', toRemove).del()
      }
    }
    await knex('template_standard').whereIn('id', toRemove).del()
    await knex('template_company').whereIn('id', toRemove).del()
    await knex('template').whereIn('id', toRemove).del()
  }

  await knex('document_type')
    .insert([{ id: tdt1 }, { id: tdt2 }])
    .onConflict('id')
    .ignore()

  await knex('template')
    .insert([
      {
        id: tc_parent_1,
        document_type_id: tdt1,
        status: 'active',
        name: 'Plantilla por empresa (semilla 1)',
        description: null,
        content_json: MIN_TEMPLATE_DOC,
        code: null,
      },
      {
        id: tc_parent_2,
        document_type_id: tdt2,
        status: 'active',
        name: 'Plantilla por empresa (semilla 2)',
        description: null,
        content_json: MIN_TEMPLATE_DOC,
        code: null,
      },
      {
        id: ts_parent_1,
        document_type_id: tdt1,
        status: 'active',
        name: 'Plantilla estándar (semilla 1)',
        description: null,
        content_json: MIN_TEMPLATE_DOC,
        code: 'PLANTILLA-SEED-01',
      },
      {
        id: ts_parent_2,
        document_type_id: tdt2,
        status: 'active',
        name: 'Plantilla estándar (semilla 2)',
        description: null,
        content_json: MIN_TEMPLATE_DOC,
        code: 'PLANTILLA-SEED-02',
      },
      {
        id: ts_parent_3,
        document_type_id: tdt1,
        status: 'active',
        name: 'Plantilla estándar (semilla 3)',
        description: null,
        content_json: MIN_TEMPLATE_DOC,
        code: 'PLANTILLA-SEED-03',
      },
    ])
    .onConflict('id')
    .ignore()

  await knex('template_company')
    .insert([
      { id: tc_parent_1, company_id: c1, code: 'EMP-PLANT-001' },
      { id: tc_parent_2, company_id: c2, code: 'EMP-PLANT-002' },
    ])
    .onConflict('id')
    .ignore()

  await knex('template_standard')
    .insert([{ id: ts_parent_1 }, { id: ts_parent_2 }, { id: ts_parent_3 }])
    .onConflict('id')
    .ignore()
}
