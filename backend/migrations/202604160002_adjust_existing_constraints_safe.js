/**
 * Defensive alignment for existing Supabase/project tables.
 *
 * IMPORTANT: This migration MUST NOT recreate existing tables.
 * It only adds missing constraints/indexes when safe, and fails fast on data issues.
 */

async function hasFkOnColumn(knex, { tableName, columnName, refTable }) {
  const result = await knex.raw(
    `
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any (c.conkey)
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    where c.contype = 'f'
      and n.nspname = current_schema()
      and t.relname = ?
      and a.attname = ?
      and (rn.nspname || '.' || rt.relname) = ?
    limit 1
  `,
    [tableName, columnName, refTable]
  )

  return (result?.rows?.length ?? 0) > 0
}

async function hasUniqueIndex(knex, { tableName, indexName }) {
  const result = await knex.raw(
    `
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = current_schema()
      and c.relname = ?
    limit 1
  `,
    [indexName]
  )
  return (result?.rows?.length ?? 0) > 0
}

exports.up = async function up(knex) {
  const hasUserProfile = await knex.schema.hasTable('user_profile')
  const hasProfile = await knex.schema.hasTable('profile')
  const hasNavNode = await knex.schema.hasTable('navigation_node')
  const hasGrant = await knex.schema.hasTable('profile_navigation_grant')

  if (!hasProfile || !hasUserProfile || !hasNavNode || !hasGrant) {
    throw new Error(
      'Expected existing tables missing. Ensure previous migrations ran: profile, user_profile, navigation_node, profile_navigation_grant.'
    )
  }

  // Pre-check: duplicated user_id would break 1:1
  const dupUserId = await knex.raw(
    `
    select user_id
    from user_profile
    group by user_id
    having count(*) > 1
    limit 1
  `
  )
  if ((dupUserId?.rows?.length ?? 0) > 0) {
    throw new Error(
      `Cannot enforce UNIQUE(user_id) on user_profile: duplicated user_id detected (example: ${dupUserId.rows[0].user_id}).`
    )
  }

  const orphanProfile = await knex.raw(
    `
    select up.profile_id
    from user_profile up
    left join profile p on p.id = up.profile_id
    where p.id is null
    limit 1
  `
  )
  if ((orphanProfile?.rows?.length ?? 0) > 0) {
    throw new Error(
      `Cannot enforce FK user_profile.profile_id -> profile.id: orphan profile_id detected (example: ${orphanProfile.rows[0].profile_id}).`
    )
  }

  // UNIQUE(user_id) – implemented as unique index (idempotent).
  const userIdUniqueIndex = 'user_profile_user_id_uq_idx'
  if (!(await hasUniqueIndex(knex, { tableName: 'user_profile', indexName: userIdUniqueIndex }))) {
    await knex.raw(`create unique index if not exists ${userIdUniqueIndex} on user_profile (user_id)`)
  }

  // Ensure FKs exist (avoid duplicates by checking presence first).
  if (
    !(await hasFkOnColumn(knex, {
      tableName: 'user_profile',
      columnName: 'profile_id',
      refTable: 'public.profile',
    }))
  ) {
    await knex.raw(`
      alter table user_profile
      add constraint user_profile_profile_id_fk
      foreign key (profile_id) references profile(id)
      on delete restrict
    `)
  }

  // profile_navigation_grant uniqueness (idempotent unique index)
  const grantUniqueIndex = 'profile_navigation_grant_profile_node_uq_idx'
  if (!(await hasUniqueIndex(knex, { tableName: 'profile_navigation_grant', indexName: grantUniqueIndex }))) {
    await knex.raw(
      `create unique index if not exists ${grantUniqueIndex} on profile_navigation_grant (profile_id, navigation_node_id)`
    )
  }

  // navigation_node parent_id FK (only if data is compatible)
  const orphanParent = await knex.raw(
    `
    select parent_id
    from navigation_node
    where parent_id is not null
      and parent_id not in (select id from navigation_node)
    limit 1
  `
  )
  if ((orphanParent?.rows?.length ?? 0) === 0) {
    const hasParentFk = await hasFkOnColumn(knex, {
      tableName: 'navigation_node',
      columnName: 'parent_id',
      refTable: 'public.navigation_node',
    })
    if (!hasParentFk) {
      await knex.raw(`
        alter table navigation_node
        add constraint navigation_node_parent_id_fk
        foreign key (parent_id) references navigation_node(id)
        on delete cascade
      `)
    }
  }
}

exports.down = async function down(knex) {
  // Remove only constraints/indexes introduced by this migration (best-effort).
  await knex.raw(`drop index if exists user_profile_user_id_uq_idx`)
  await knex.raw(`drop index if exists profile_navigation_grant_profile_node_uq_idx`)

  await knex.raw(`alter table user_profile drop constraint if exists user_profile_user_id_fk`)
  await knex.raw(`alter table user_profile drop constraint if exists user_profile_profile_id_fk`)
  await knex.raw(`alter table navigation_node drop constraint if exists navigation_node_parent_id_fk`)
}

