exports.up = async (knex) => {
  await knex.schema.alterTable('company', (t) => t.text('short_name').nullable())
  await knex('company').whereNull('short_name').update({ short_name: knex.ref('business_name') })
  await knex.raw('ALTER TABLE company ALTER COLUMN short_name SET NOT NULL')
}

exports.down = async (knex) => {
  await knex.schema.alterTable('company', (t) => t.dropColumn('short_name'))
}
