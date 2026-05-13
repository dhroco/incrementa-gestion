/**
 * Profiles + user profile assignment (initial).
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('profile', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.text('code').notNullable().unique()
    table.text('label').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('user_profile', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('user_id')
      .notNullable()
      // FK to Supabase Auth users
      .references('id')
      .inTable('auth.users')
      .onDelete('CASCADE')
    table.uuid('profile_id').notNullable().references('id').inTable('profile').onDelete('RESTRICT')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.unique(['user_id'])
    table.index(['profile_id'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('user_profile')
  await knex.schema.dropTableIfExists('profile')
}

