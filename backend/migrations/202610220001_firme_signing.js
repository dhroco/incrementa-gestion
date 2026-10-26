/**
 * Intentos de firma con Firme y eventos del webhook SNS.
 * Reversible: down borra primero el webhook y después la firma.
 * No agrega un check a draft_document.status.
 */

const STATUS_CHECK =
  "status in ('sending', 'pending_signature', 'signed', 'rejected', 'expired', 'cancelled', 'send_failed', 'hash_mismatch')"

const ACTIVE_ATTEMPT_INDEX = `
  CREATE UNIQUE INDEX firme_signing_one_active_attempt
  ON firme_signing (draft_document_id)
  WHERE status IN ('sending', 'pending_signature')
`

exports.up = async function up(knex) {
  await knex.schema.createTable('firme_signing', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('draft_document_id').notNullable().references('id').inTable('draft_document')
    table.integer('attempt').notNullable()
    table.text('status').notNullable()
    table.check(STATUS_CHECK, [], 'firme_signing_status_check')
    table.uuid('document_id').notNullable()
    table.uuid('approved_by').nullable().references('id').inTable('user_profile')
    table.timestamp('approved_at', { useTz: true }).notNullable()
    table.text('signee_first_name').notNullable()
    table.text('signee_last_name').notNullable()
    table.text('signee_maternal_last_name').notNullable()
    table.text('signee_rut').notNullable()
    table.text('signee_email').notNullable()
    table.integer('stamp_page').nullable()
    table.decimal('stamp_x', 6, 5).nullable()
    table.decimal('stamp_y', 6, 5).nullable()
    table.text('stamped_gcs_path').nullable()
    table.text('stamped_sha256').nullable()
    table.integer('stamped_byte_length').nullable()
    table.text('firme_transaction_id').nullable()
    table.text('firme_document_code').nullable()
    table.text('firme_signee_private_code').nullable()
    table.text('firme_status').nullable()
    table.timestamp('signee_signed_on', { useTz: true }).nullable()
    table.text('signed_gcs_path').nullable()
    table.text('evidence_gcs_path').nullable()
    table.text('signed_sha256').nullable()
    table.timestamp('verified_at', { useTz: true }).nullable()
    table.text('last_error_code').nullable()
    table.text('last_error_message').nullable()
    table.text('rejection_reason').nullable()
    table.timestamp('last_checked_at', { useTz: true }).nullable()
    table.timestamp('link_renewed_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['draft_document_id', 'attempt'])
    table.index(['firme_document_code'])
    table.index(['status'])
  })

  await knex.raw(ACTIVE_ATTEMPT_INDEX)

  await knex.schema.createTable('firme_webhook_event', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.text('event_id').unique().nullable()
    table.text('sns_message_id').nullable()
    table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.text('message_type').nullable()
    table.jsonb('body').nullable()
    table
      .uuid('firme_signing_id')
      .nullable()
      .references('id')
      .inTable('firme_signing')
      .onDelete('SET NULL')
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('firme_webhook_event')
  await knex.schema.dropTableIfExists('firme_signing')
}
