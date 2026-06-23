/**
 * Destructive: remove CONTADOR and USUARIO_EMPRESA_ADMINISTRADOR profiles and related tables.
 * Irreversible — down throws.
 */

exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists('accountant_company')
  await knex.schema.dropTableIfExists('accountant')
  await knex.schema.dropTableIfExists('company_internal_user')

  await knex('user_profile')
    .whereIn('profile_id', function subquery() {
      this.select('id')
        .from('profile')
        .whereIn('code', ['CONTADOR', 'USUARIO_EMPRESA_ADMINISTRADOR'])
    })
    .del()

  await knex('profile').whereIn('code', ['CONTADOR', 'USUARIO_EMPRESA_ADMINISTRADOR']).del()
}

exports.down = async function down() {
  throw new Error('Irreversible migration: drop_contador_empresa_profiles')
}
