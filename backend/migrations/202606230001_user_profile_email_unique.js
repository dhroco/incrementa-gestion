exports.up = async (knex) => {
  const duplicates = await knex('user_profile')
    .select(knex.raw('LOWER(email) AS normalized_email'))
    .count('* as count')
    .whereNotNull('email')
    .groupBy(knex.raw('LOWER(email)'))
    .havingRaw('COUNT(*) > 1')

  if (duplicates.length > 0) {
    const emails = duplicates.map((row) => row.normalized_email).join(', ')
    throw new Error(
      `Cannot create unique email index: duplicate user_profile emails found (case-insensitive): ${emails}. Resolve duplicates manually before migrating.`
    )
  }

  await knex.raw(`
    CREATE UNIQUE INDEX user_profile_email_lower_unique
      ON user_profile (LOWER(email))
      WHERE email IS NOT NULL
  `)
}

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS user_profile_email_lower_unique')
}
