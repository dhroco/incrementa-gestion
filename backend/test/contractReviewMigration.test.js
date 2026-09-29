const test = require('node:test')
const assert = require('node:assert/strict')
const { up, down } = require('../migrations/202609290002_contract_review')

function columnChain() {
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined
        return () => chain
      }
    }
  )
  return chain
}

function tableBuilder(table, ops) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'dropColumn') {
          return (column) => {
            ops.push({ op: 'dropColumn', table, column })
            return columnChain()
          }
        }
        return () => columnChain()
      }
    }
  )
}

function recordingKnex() {
  const ops = []
  function knex() {
    throw new Error('esta prueba no consulta filas')
  }
  knex.raw = (sql) => ({ sql: String(sql) })
  knex.fn = { now: () => 'now' }
  knex.schema = {
    async createTable(table, build) {
      ops.push({ op: 'createTable', table })
      build(tableBuilder(table, ops))
    },
    async alterTable(table, build) {
      ops.push({ op: 'alterTable', table })
      build(tableBuilder(table, ops))
    },
    async dropTableIfExists(table) {
      ops.push({ op: 'dropTable', table })
    }
  }
  knex.ops = ops
  return knex
}

test('down reverses both changes', async () => {
  const knex = recordingKnex()
  await up(knex)
  await down(knex)

  const droppedColumns = knex.ops
    .filter((op) => op.op === 'dropColumn' && op.table === 'draft_document')
    .map((op) => op.column)
  assert.deepEqual(droppedColumns.sort(), ['review_id', 'review_override_reason'])

  const dropColumnAt = knex.ops.findIndex((op) => op.op === 'dropColumn')
  const dropTableAt = knex.ops.findIndex((op) => op.op === 'dropTable' && op.table === 'contract_review')
  assert.ok(dropColumnAt !== -1)
  assert.ok(dropTableAt !== -1)
  assert.ok(dropColumnAt < dropTableAt)

  const stillHasReview = knex.ops
    .filter((op) => op.op === 'dropTable' && op.table === 'contract_review')
    .length
  assert.equal(stillHasReview, 1)
  assert.equal(
    knex.ops.some((op) => op.op === 'createTable' && op.table === 'contract_review'),
    true
  )
})
