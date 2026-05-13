/**
 * Add template.document_type_id (1:N document_type -> template).
 *
 * Each template belongs to a document type.
 * This migration is defensive: it backfills existing templates to a valid document_type.
 */

exports.up = async function up(knex) {
  const hasDocumentType = await knex.schema.hasTable('document_type')
  const hasTemplate = await knex.schema.hasTable('template')

  if (!hasDocumentType || !hasTemplate) {
    throw new Error('Missing required tables: document_type and/or template. Run base migrations first.')
  }

  const hasColumn = await knex.schema.hasColumn('template', 'document_type_id')
  if (!hasColumn) {
    await knex.schema.alterTable('template', (table) => {
      table.uuid('document_type_id').nullable()
    })
  }

  // Ensure at least one document_type exists for backfill.
  const existingType = await knex('document_type').select('id').first()
  let typeId = existingType?.id
  if (!typeId) {
    const inserted = await knex('document_type')
      .insert([{ id: knex.raw('gen_random_uuid()') }])
      .returning('id')
    typeId = Array.isArray(inserted) ? inserted[0]?.id ?? inserted[0] : inserted?.id
  }

  // Backfill existing templates with NULL document_type_id.
  await knex('template').whereNull('document_type_id').update({ document_type_id: typeId })

  // Add FK constraint if missing.
  await knex.raw(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where c.contype = 'f'
          and n.nspname = current_schema()
          and t.relname = 'template'
          and c.conname = 'template_document_type_id_fk'
      ) then
        alter table template
        add constraint template_document_type_id_fk
        foreign key (document_type_id) references document_type(id)
        on delete restrict;
      end if;
    end $$;
  `)

  // Enforce NOT NULL (now safe after backfill).
  await knex.schema.alterTable('template', (table) => {
    table.uuid('document_type_id').notNullable().alter()
  })

  await knex.raw(`create index if not exists template_document_type_id_idx on template (document_type_id)`)
}

exports.down = async function down(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) return

  await knex.raw(`drop index if exists template_document_type_id_idx`)
  await knex.raw(`alter table template drop constraint if exists template_document_type_id_fk`)

  const hasColumn = await knex.schema.hasColumn('template', 'document_type_id')
  if (hasColumn) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('document_type_id')
    })
  }
}

