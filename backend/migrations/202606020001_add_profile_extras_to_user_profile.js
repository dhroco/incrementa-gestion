exports.up = async (knex) => {
  await knex.schema.alterTable('user_profile', (t) => {
    t.text('avatar_gcs_path').nullable()
    t.text('contact_email').nullable()
    t.jsonb('widget_preferences').nullable()
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('user_profile', (t) => {
    t.dropColumn('avatar_gcs_path')
    t.dropColumn('contact_email')
    t.dropColumn('widget_preferences')
  })
}
