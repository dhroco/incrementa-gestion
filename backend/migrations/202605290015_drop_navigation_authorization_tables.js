exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('profile_navigation_grant')
  await knex.schema.dropTableIfExists('navigation_node')
}

exports.down = async function (_knex) {}
