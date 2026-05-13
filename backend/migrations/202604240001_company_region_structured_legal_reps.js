/**
 * Add headquarters region, structured legal representative fields,
 * backfill name from legacy free-text columns, drop legacy columns.
 */

async function addColumnIfMissing(knex, tableName, columnName, addCb) {
  const exists = await knex.schema.hasColumn(tableName, columnName)
  if (exists) return
  await knex.schema.alterTable(tableName, addCb)
}

exports.up = async function up(knex) {
  const hasCompany = await knex.schema.hasTable('company')
  if (!hasCompany) return

  await addColumnIfMissing(knex, 'company', 'region', (table) => {
    table.text('region').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'name_legal_representative_1', (table) => {
    table.text('name_legal_representative_1').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'rut_body_legal_representative_1', (table) => {
    table.text('rut_body_legal_representative_1').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'rut_dv_legal_representative_1', (table) => {
    table.text('rut_dv_legal_representative_1').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'name_legal_representative_2', (table) => {
    table.text('name_legal_representative_2').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'rut_body_legal_representative_2', (table) => {
    table.text('rut_body_legal_representative_2').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'rut_dv_legal_representative_2', (table) => {
    table.text('rut_dv_legal_representative_2').nullable()
  })

  const hasLegacy1 = await knex.schema.hasColumn('company', 'legal_representative_1')
  if (hasLegacy1) {
    await knex.raw(`
      UPDATE public.company
      SET name_legal_representative_1 = NULLIF(TRIM(legal_representative_1), '')
      WHERE legal_representative_1 IS NOT NULL
    `)
  }
  const hasLegacy2 = await knex.schema.hasColumn('company', 'legal_representative_2')
  if (hasLegacy2) {
    await knex.raw(`
      UPDATE public.company
      SET name_legal_representative_2 = NULLIF(TRIM(legal_representative_2), '')
      WHERE legal_representative_2 IS NOT NULL
    `)
  }

  if (hasLegacy1) {
    await knex.schema.alterTable('company', (table) => {
      table.dropColumn('legal_representative_1')
    })
  }
  if (hasLegacy2) {
    await knex.schema.alterTable('company', (table) => {
      table.dropColumn('legal_representative_2')
    })
  }
}

exports.down = async function down(knex) {
  const hasCompany = await knex.schema.hasTable('company')
  if (!hasCompany) return

  await addColumnIfMissing(knex, 'company', 'legal_representative_1', (table) => {
    table.text('legal_representative_1').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'legal_representative_2', (table) => {
    table.text('legal_representative_2').nullable()
  })

  await knex.raw(`
    UPDATE public.company
    SET legal_representative_1 = name_legal_representative_1
    WHERE name_legal_representative_1 IS NOT NULL
  `)
  await knex.raw(`
    UPDATE public.company
    SET legal_representative_2 = name_legal_representative_2
    WHERE name_legal_representative_2 IS NOT NULL
  `)

  const dropIf = async (col) => {
    if (await knex.schema.hasColumn('company', col)) {
      await knex.schema.alterTable('company', (table) => {
        table.dropColumn(col)
      })
    }
  }
  await dropIf('region')
  await dropIf('name_legal_representative_1')
  await dropIf('rut_body_legal_representative_1')
  await dropIf('rut_dv_legal_representative_1')
  await dropIf('name_legal_representative_2')
  await dropIf('rut_body_legal_representative_2')
  await dropIf('rut_dv_legal_representative_2')
}
