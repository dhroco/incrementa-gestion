const test = require('node:test')
const assert = require('node:assert/strict')
const { up } = require('../migrations/202609290002_contract_review')

function columnChain(calls) {
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined
        return (...args) => {
          calls.push({ method: String(prop), args })
          return chain
        }
      }
    }
  )
  return chain
}

function tableProxy(table, columns) {
  return new Proxy(
    {},
    {
      get() {
        return (name) => {
          const calls = []
          columns.push({ table, name, calls })
          return columnChain(calls)
        }
      }
    }
  )
}

test('review_id uses ON DELETE NO ACTION', async () => {
  const columns = []
  const knex = {
    raw: (sql) => ({ sql: String(sql) }),
    fn: { now: () => 'now' },
    schema: {
      async createTable(table, build) {
        build(tableProxy(table, columns))
      },
      async alterTable(table, build) {
        build(tableProxy(table, columns))
      }
    }
  }
  await up(knex)

  function onDeleteOf(table, name) {
    const column = columns.find((item) => item.table === table && item.name === name)
    assert.ok(column, `${table}.${name}`)
    const call = column.calls.find((item) => item.method === 'onDelete')
    assert.ok(call, `${table}.${name} onDelete`)
    return call.args[0]
  }

  assert.equal(onDeleteOf('draft_document', 'review_id'), 'NO ACTION')
  assert.equal(onDeleteOf('contract_review', 'company_id'), 'CASCADE')
  assert.equal(onDeleteOf('contract_review', 'supplier_id'), 'CASCADE')
})
