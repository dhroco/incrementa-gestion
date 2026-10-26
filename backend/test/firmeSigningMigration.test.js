const test = require('node:test')
const assert = require('node:assert/strict')

const migration = require('../migrations/202610220001_firme_signing')

function columnChain(spec) {
  const chain = {
    primary() {
      spec.primary = true
      return chain
    },
    unique() {
      spec.unique = true
      return chain
    },
    nullable() {
      spec.nullable = true
      return chain
    },
    notNullable() {
      spec.nullable = false
      return chain
    },
    defaultTo(value) {
      spec.defaultTo = value
      return chain
    },
    references(column) {
      spec.references = column
      return chain
    },
    inTable(table) {
      spec.inTable = table
      return chain
    },
    onDelete(rule) {
      spec.onDelete = rule
      return chain
    }
  }
  return chain
}

function createSchemaDouble() {
  const tables = []
  const dropped = []
  const raws = []

  const knex = {
    fn: { now: () => 'NOW()' },
    raw(sql) {
      raws.push(sql)
      return { sql }
    },
    schema: {
      async createTable(name, builderFn) {
        const table = { name, columns: [], checks: [], uniques: [], indexes: [] }
        const builder = {
          uuid(column) {
            const spec = { name: column, type: 'uuid', nullable: true }
            table.columns.push(spec)
            return columnChain(spec)
          },
          integer(column) {
            const spec = { name: column, type: 'integer', nullable: true }
            table.columns.push(spec)
            return columnChain(spec)
          },
          text(column) {
            const spec = { name: column, type: 'text', nullable: true }
            table.columns.push(spec)
            return columnChain(spec)
          },
          decimal(column, precision, scale) {
            const spec = { name: column, type: 'decimal', precision, scale, nullable: true }
            table.columns.push(spec)
            return columnChain(spec)
          },
          timestamp(column, options) {
            const spec = { name: column, type: 'timestamp', options, nullable: true }
            table.columns.push(spec)
            return columnChain(spec)
          },
          jsonb(column) {
            const spec = { name: column, type: 'jsonb', nullable: true }
            table.columns.push(spec)
            return columnChain(spec)
          },
          check(predicate, bindings, constraintName) {
            table.checks.push({ predicate, bindings, constraintName })
          },
          unique(columns) {
            table.uniques.push(columns)
          },
          index(columns) {
            table.indexes.push(columns)
          }
        }
        builderFn(builder)
        tables.push(table)
      },
      async dropTableIfExists(name) {
        dropped.push(name)
      }
    }
  }

  return { knex, tables, dropped, raws }
}

test('up and down are functions and the active-attempt guard is declared', async () => {
  assert.equal(typeof migration.up, 'function')
  assert.equal(typeof migration.down, 'function')

  const { knex, tables, dropped, raws } = createSchemaDouble()
  await migration.up(knex)

  const signing = tables.find((table) => table.name === 'firme_signing')
  const webhook = tables.find((table) => table.name === 'firme_webhook_event')
  assert.ok(signing)
  assert.ok(webhook)

  const statusCheck = signing.checks.map((check) => check.predicate).join(' ')
  for (const status of [
    'sending',
    'pending_signature',
    'signed',
    'rejected',
    'expired',
    'cancelled',
    'send_failed',
    'hash_mismatch'
  ]) {
    assert.match(statusCheck, new RegExp(status))
  }

  const partial = raws.join('\n')
  assert.match(partial, /UNIQUE INDEX/i)
  assert.match(partial, /draft_document_id/)
  assert.match(partial, /sending/)
  assert.match(partial, /pending_signature/)

  assert.ok(
    signing.uniques.some(
      (columns) => columns.includes('draft_document_id') && columns.includes('attempt')
    )
  )
  assert.ok(signing.columns.some((column) => column.name === 'link_renewed_at'))
  assert.ok(signing.indexes.some((columns) => columns.includes('firme_document_code')))
  assert.ok(signing.indexes.some((columns) => columns.includes('status')))

  const eventId = webhook.columns.find((column) => column.name === 'event_id')
  assert.equal(eventId.unique, true)
  assert.equal(eventId.nullable, true)

  await migration.down(knex)
  assert.deepEqual(dropped, ['firme_webhook_event', 'firme_signing'])
})
