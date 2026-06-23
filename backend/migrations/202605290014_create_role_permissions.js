exports.up = async function (knex) {
  await knex.schema.createTable('role_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('role_id')
      .notNullable()
      .references('id')
      .inTable('profile')
      .onDelete('CASCADE')
    t.string('action', 50).notNullable()
    t.string('subject', 100).notNullable()
    t.jsonb('fields').nullable()
    t.jsonb('conditions').nullable()
    t.boolean('inverted').notNullable().defaultTo(false)
    t.string('reason', 255).nullable()
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    t.index(['role_id'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('role_permissions')
}
