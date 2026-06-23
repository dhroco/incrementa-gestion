/**
 * Drop employee/position/work_schedule; rewire generated_document to supplier_id.
 */

function uuidPk(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
}

function timestamps(table, knex, { withUpdatedAt = true } = {}) {
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  if (withUpdatedAt) {
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  }
}

async function dropEmployeeIdFromGeneratedDocument(knex) {
  const hasTable = await knex.schema.hasTable('generated_document')
  if (!hasTable) return

  await knex('generated_document').del()

  const hasEmployeeCol = await knex.schema.hasColumn('generated_document', 'employee_id')
  if (hasEmployeeCol) {
    await knex.schema.alterTable('generated_document', (table) => {
      table.dropForeign(['employee_id'])
    })
    await knex.schema.alterTable('generated_document', (table) => {
      table.dropColumn('employee_id')
    })
  }

  const hasSupplierCol = await knex.schema.hasColumn('generated_document', 'supplier_id')
  if (!hasSupplierCol) {
    await knex.schema.alterTable('generated_document', (table) => {
      table
        .uuid('supplier_id')
        .notNullable()
        .references('id')
        .inTable('supplier')
        .onDelete('CASCADE')
      table.index(['supplier_id'])
    })
  }
}

async function dropEmployeeIdFromDocument(knex) {
  const hasTable = await knex.schema.hasTable('document')
  if (!hasTable) return

  await knex('document').del()

  const hasEmployeeCol = await knex.schema.hasColumn('document', 'employee_id')
  if (!hasEmployeeCol) return

  await knex.schema.alterTable('document', (table) => {
    table.dropForeign(['employee_id'])
  })
  await knex.schema.alterTable('document', (table) => {
    table.dropColumn('employee_id')
  })
}

exports.up = async function up(knex) {
  await dropEmployeeIdFromGeneratedDocument(knex)
  await dropEmployeeIdFromDocument(knex)

  await knex.schema.dropTableIfExists('employee')
  await knex.schema.dropTableIfExists('position')
  await knex.schema.dropTableIfExists('work_schedule')
}

exports.down = async function down(knex) {
  if (!(await knex.schema.hasTable('position'))) {
    await knex.schema.createTable('position', (table) => {
      uuidPk(table, knex)
      table.uuid('company_id').notNullable().references('id').inTable('company').onDelete('CASCADE')
      timestamps(table, knex, { withUpdatedAt: true })
      table.text('name').notNullable().defaultTo('Cargo')
      table.text('description').nullable()
      table.index(['company_id'])
    })
  }

  if (!(await knex.schema.hasTable('work_schedule'))) {
    await knex.schema.createTable('work_schedule', (table) => {
      uuidPk(table, knex)
      table.uuid('company_id').notNullable().references('id').inTable('company').onDelete('CASCADE')
      timestamps(table, knex, { withUpdatedAt: true })
      table.text('name').notNullable().defaultTo('Jornada')
      table.index(['company_id'])
    })
  }

  if (!(await knex.schema.hasTable('employee'))) {
    await knex.schema.createTable('employee', (table) => {
      uuidPk(table, knex)
      table.uuid('company_id').notNullable().references('id').inTable('company').onDelete('CASCADE')
      table.uuid('position_id').notNullable().references('id').inTable('position').onDelete('RESTRICT')
      table
        .uuid('work_schedule_id')
        .notNullable()
        .references('id')
        .inTable('work_schedule')
        .onDelete('RESTRICT')
      timestamps(table, knex, { withUpdatedAt: true })
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
      table.text('email').nullable()
      table.text('address').nullable()
      table.text('commune').nullable()
      table.text('city').nullable()
      table.text('prevision_salud').nullable()
      table.text('fondo_pension').nullable()
      table.index(['company_id'])
      table.index(['position_id'])
      table.index(['work_schedule_id'])
    })

    await knex.raw(
      'alter table employee add constraint employee_company_rut_body_uq unique (company_id, rut_body)'
    )
    await knex.raw(
      `alter table employee add constraint employee_sex_check check (sex is null or sex in ('M','F','X'))`
    )
  }

  if (await knex.schema.hasTable('generated_document')) {
    const hasSupplierCol = await knex.schema.hasColumn('generated_document', 'supplier_id')
    if (hasSupplierCol) {
      await knex.schema.alterTable('generated_document', (table) => {
        table.dropForeign(['supplier_id'])
      })
      await knex.schema.alterTable('generated_document', (table) => {
        table.dropColumn('supplier_id')
      })
    }
    const hasEmployeeCol = await knex.schema.hasColumn('generated_document', 'employee_id')
    if (!hasEmployeeCol) {
      await knex.schema.alterTable('generated_document', (table) => {
        table
          .uuid('employee_id')
          .notNullable()
          .references('id')
          .inTable('employee')
          .onDelete('CASCADE')
        table.index(['employee_id'])
      })
    }
  }

  if (await knex.schema.hasTable('document')) {
    const hasEmployeeCol = await knex.schema.hasColumn('document', 'employee_id')
    if (!hasEmployeeCol) {
      await knex.schema.alterTable('document', (table) => {
        table
          .uuid('employee_id')
          .notNullable()
          .references('id')
          .inTable('employee')
          .onDelete('RESTRICT')
        table.index(['employee_id'])
      })
    }
  }
}
