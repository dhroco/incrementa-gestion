const test = require('node:test')
const assert = require('node:assert/strict')

const { createContractsQueryService, normalizeStatus } = require('../services/contractsQueryService')

function createQueryDb() {
  const tables = []
  const wheres = []
  function builder(table) {
    tables.push(String(table))
    const api = {
      join() {
        return api
      },
      leftJoin() {
        return api
      },
      whereNot(col, val) {
        wheres.push({ op: 'whereNot', col, val })
        return api
      },
      where(col, val) {
        wheres.push({ op: 'where', col, val })
        return api
      },
      select() {
        return api
      },
      andWhere() {
        return api
      },
      unionAll() {
        wheres.push({ op: 'unionAll' })
        return api
      }
    }
    return api
  }
  function db(table) {
    return builder(table)
  }
  db.raw = (sql, bindings) => ({ sql, bindings })
  db.count = () => ({
    from() {
      return { first: async () => ({ count: 1 }) }
    }
  })
  db.select = () => ({
    from() {
      return {
        orderBy() {
          return {
            limit() {
              return {
                offset: async () => [
                  {
                    id: 'draft-1',
                    source: 'draft',
                    status: 'in_signature',
                    file_name: 'a.pdf',
                    gcs_path: 'contratos/a.pdf',
                    contract_overrides: {}
                  }
                ]
              }
            }
          }
        }
      }
    }
  })
  db.tables = tables
  db.wheres = wheres
  return db
}

test("normalizeStatus('in_signature')", () => {
  assert.equal(normalizeStatus('in_signature'), 'in_signature')
  assert.equal(normalizeStatus('draft'), 'draft')
})

test('Filter by in-signature status', async () => {
  const db = createQueryDb()
  const service = createContractsQueryService({ db, storageService: {} })
  const result = await service.listContracts({ filters: { status: 'in_signature' } })
  assert.equal(result.data.items.length, 1)
  assert.equal(result.data.items[0].status, 'in_signature')
  assert.equal(result.data.items[0].source, 'draft')
  assert.ok(db.tables.every((table) => !table.startsWith('document')))
  assert.ok(db.wheres.some((item) => item.op === 'where' && item.col === 'dd.status' && item.val === 'in_signature'))
  assert.equal(db.wheres.some((item) => item.op === 'unionAll'), false)
})

test('draft filter keeps whereNot rejected and signed', async () => {
  const db = createQueryDb()
  const service = createContractsQueryService({ db, storageService: {} })
  await service.listContracts({ filters: { status: 'draft' } })
  assert.ok(db.tables.every((table) => !table.startsWith('document')))
  assert.ok(db.wheres.some((item) => item.op === 'whereNot' && item.val === 'rejected'))
  assert.ok(db.wheres.some((item) => item.op === 'whereNot' && item.val === 'signed'))
  assert.equal(
    db.wheres.some((item) => item.op === 'where' && item.val === 'in_signature'),
    false
  )
})
