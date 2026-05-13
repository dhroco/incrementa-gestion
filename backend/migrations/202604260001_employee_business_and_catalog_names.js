/**
 * Display names for company-scoped catalogs; full employee business fields.
 * RUT stored as rut_body + rut_dv (aligned with parseRut / user_profile).
 *
 * Nota: la restricción unique (company_id, rut_body) requiere que no haya duplicados.
 * Tras añadir columnas con default rut_body=0000000, se deduplican filas asignando
 * cuerpos únicos 7 dígitos y DV válido (computeRutDv) por empresa.
 */

const { computeRutDv } = require('../utils/rut')

/**
 * Asegura (company_id, rut_body) únicos asignando nuevos cuerpos donde haga falta.
 * @param {import('knex').Knex} knex
 */
async function dedupeEmployeeRutBodiesByCompany(knex) {
  const rows = await knex('employee').select('id', 'company_id', 'rut_body', 'rut_dv').orderBy('company_id', 'id')

  const used = new Set()
  for (const r of rows) {
    const key = `${r.company_id}\t${r.rut_body}`
    if (!used.has(key)) {
      used.add(key)
      continue
    }

    for (let n = 1; n < 1_000_000; n += 1) {
      const newBody = n.toString().padStart(7, '0')
      const k2 = `${r.company_id}\t${newBody}`
      if (used.has(k2)) continue
      const dv = computeRutDv(newBody)
      if (dv == null) continue
      // eslint-disable-next-line no-await-in-loop -- pocos empleados en entornos de migración
      await knex('employee').where({ id: r.id }).update({ rut_body: newBody, rut_dv: dv })
      used.add(k2)
      break
    }
  }
}

exports.up = async function up(knex) {
  await knex.schema.alterTable('position', (table) => {
    table.text('name').notNullable().defaultTo('Cargo')
  })
  await knex.schema.alterTable('work_schedule', (table) => {
    table.text('name').notNullable().defaultTo('Jornada')
  })

  const hasRut = await knex.schema.hasColumn('employee', 'rut_body')
  if (!hasRut) {
    await knex.schema.alterTable('employee', (table) => {
      table.text('full_name').notNullable().defaultTo('Sin nombre')
      table.text('rut_body').notNullable().defaultTo('0000000')
      table.text('rut_dv').notNullable().defaultTo('0')
      table.text('nationality').nullable()
      table.string('sex', 1).nullable()
      table.text('marital_status').nullable()
      table.date('date_of_birth').nullable()
      table.date('hire_date').nullable()
      table.decimal('base_salary', 15, 2).notNullable().defaultTo(0)
      table.decimal('gratification', 15, 2).notNullable().defaultTo(0)
      table.decimal('transport_allowance', 15, 2).notNullable().defaultTo(0)
      table.decimal('meal_allowance', 15, 2).notNullable().defaultTo(0)
      table.decimal('bonuses', 15, 2).notNullable().defaultTo(0)
      table.decimal('commissions', 15, 2).notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
    })
  }

  await dedupeEmployeeRutBodiesByCompany(knex)

  const hasUq = await knex
    .select(1)
    .from('pg_constraint')
    .where('conname', 'employee_company_rut_body_uq')
    .first()
  if (!hasUq) {
    await knex.raw(
      'alter table employee add constraint employee_company_rut_body_uq unique (company_id, rut_body)'
    )
  }

  const hasSexCheck = await knex
    .select(1)
    .from('pg_constraint')
    .where('conname', 'employee_sex_check')
    .first()
  if (!hasSexCheck) {
    await knex.raw(
      `alter table employee add constraint employee_sex_check check (sex is null or sex in ('M','F','X'))`
    )
  }
}

exports.down = async function down(knex) {
  await knex.raw('alter table employee drop constraint if exists employee_sex_check')
  await knex.raw('alter table employee drop constraint if exists employee_company_rut_body_uq')
  const hasRut = await knex.schema.hasColumn('employee', 'rut_body')
  if (hasRut) {
    await knex.schema.alterTable('employee', (table) => {
      table.dropColumn('is_active')
      table.dropColumn('commissions')
      table.dropColumn('bonuses')
      table.dropColumn('meal_allowance')
      table.dropColumn('transport_allowance')
      table.dropColumn('gratification')
      table.dropColumn('base_salary')
      table.dropColumn('hire_date')
      table.dropColumn('date_of_birth')
      table.dropColumn('marital_status')
      table.dropColumn('sex')
      table.dropColumn('nationality')
      table.dropColumn('rut_dv')
      table.dropColumn('rut_body')
      table.dropColumn('full_name')
    })
  }
  const hasWorkScheduleName = await knex.schema.hasColumn('work_schedule', 'name')
  if (hasWorkScheduleName) {
    await knex.schema.alterTable('work_schedule', (table) => {
      table.dropColumn('name')
    })
  }
  const hasPositionName = await knex.schema.hasColumn('position', 'name')
  if (hasPositionName) {
    await knex.schema.alterTable('position', (table) => {
      table.dropColumn('name')
    })
  }
}
