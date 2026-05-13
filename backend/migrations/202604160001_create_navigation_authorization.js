/**
 * Navigation tree + profile grants (source of truth for allowed routes / menu structure).
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('navigation_node', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('parent_id')
      .nullable()
      .references('id')
      .inTable('navigation_node')
      .onDelete('CASCADE')
    table.text('code').notNullable().unique()
    table.text('label').notNullable()
    table.text('route_path').nullable()
    table.text('module_title').nullable()
    table.integer('sort_order').notNullable().defaultTo(0)
    table.boolean('is_active').notNullable().defaultTo(true)
    table.boolean('show_in_main_menu').notNullable().defaultTo(true)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.index(['parent_id'])
    table.index(['sort_order'])
  })

  await knex.schema.createTable('profile_navigation_grant', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('profile_id')
      .notNullable()
      .references('id')
      .inTable('profile')
      .onDelete('CASCADE')
    table
      .uuid('navigation_node_id')
      .notNullable()
      .references('id')
      .inTable('navigation_node')
      .onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.unique(['profile_id', 'navigation_node_id'])
    table.index(['profile_id'])
    table.index(['navigation_node_id'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('profile_navigation_grant')
  await knex.schema.dropTableIfExists('navigation_node')
}
