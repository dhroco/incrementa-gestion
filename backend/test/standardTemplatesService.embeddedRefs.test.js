const test = require('node:test')
const assert = require('node:assert/strict')
const { createStandardTemplatesService } = require('../services/standardTemplatesService')
const { collectEmbeddedClauseIdsFromDoc } = require('../utils/templateContentJson')

function makeTrx({ universalIds }) {
  const universalSet = new Set(universalIds)
  const calls = []
  /** @type {any | null} */
  let lastInsertedTemplate = null

  function record(sql, bindings) {
    calls.push({ sql: String(sql), bindings })
  }

  function fluentSelectFinal(table) {
    return {
      whereIn(col, ids) {
        if (table === 'clause_universal' && col === 'id') {
          const rows = (ids || []).filter((id) => universalSet.has(id)).map((id) => ({ id }))
          // Knex: `await qb.select(...).whereIn(...)` resolves to row array (not a thenable builder).
          return Promise.resolve(rows)
        }
        return Promise.resolve([])
      },
      where(_col, _op, maybeId) {
        return {
          first: async () => {
            const id = arguments.length === 2 ? _op : maybeId
            if (String(table).includes('template as t') && lastInsertedTemplate && id) {
              return {
                id,
                name: lastInsertedTemplate.name,
                code: lastInsertedTemplate.code,
                description: lastInsertedTemplate.description,
                status: lastInsertedTemplate.status,
                document_type_id: lastInsertedTemplate.document_type_id,
                content_json: lastInsertedTemplate.content_json,
                created_by: lastInsertedTemplate.created_by,
                updated_by: lastInsertedTemplate.updated_by,
                last_edited_by: lastInsertedTemplate.last_edited_by,
                created_by_name: null,
                updated_by_name: null,
                last_edited_by_name: null,
                created_at: lastInsertedTemplate.created_at ?? new Date().toISOString(),
                updated_at: lastInsertedTemplate.updated_at ?? new Date().toISOString(),
              }
            }
            return null
          },
        }
      },
      first: async () => null,
    }
  }

  function createBuilder(table) {
    return {
      insert: async (row) => {
        record(`insert:${table}`, row)
        // `createStandardTemplate` inserts into `template` then `template_standard`.
        // Only capture the main row — the follow-up insert must not clobber this stub state.
        if (table === 'template') lastInsertedTemplate = { ...row }
        return row
      },
      del: async () => {
        record(`del:${table}`, null)
        return 0
      },
      update: async () => {
        record(`update:${table}`, null)
        return 1
      },
      join() {
        return this
      },
      leftJoin() {
        return this
      },
      orderBy() {
        return this
      },
      whereIn(col, ids) {
        if (table === 'clause_universal' && col === 'id') {
          const rows = (ids || []).filter((id) => universalSet.has(id)).map((id) => ({ id }))
          return {
            select: async () => rows,
            first: async () => rows[0] ?? null,
          }
        }
        return {
          select: async () => [],
          first: async () => null,
        }
      },
      select() {
        record(`select:${table}`, null)
        return fluentSelectFinal(table)
      },
      first: async () => null,
    }
  }

  const trx = function trxFn(table) {
    return createBuilder(table)
  }

  trx.raw = (sql) => sql
  trx.fn = { now: () => new Date() }

  return { trx, calls }
}

test('createStandardTemplate rejects company embedded clause kind for standard templates (no inserts)', async () => {
  let txnCalls = 0
  const db = {
    transaction: async (fn) => {
      txnCalls += 1
      const { trx, calls } = makeTrx({ universalIds: [] })
      const out = await fn(trx)
      const joined = calls.map((c) => c.sql).join('\n')
      assert.ok(!joined.includes('insert:template'))
      assert.ok(!joined.includes('template_clause'))
      return out
    },
  }

  const svc = createStandardTemplatesService({ db })
  const content_json = {
    type: 'doc',
    content: [
      {
        type: 'embeddedUniversalClause',
        attrs: { clauseId: 'c1', clauseKind: 'company', companyId: 'co1' },
      },
    ],
  }

  const res = await svc.createStandardTemplate({
    name: 'P',
    code: 'PLANT-X',
    description: null,
    content_json,
    status: 'draft',
    document_type_id: 'dt1',
    actorUserProfileId: 'up1',
  })

  assert.equal(txnCalls, 1)
  assert.equal(res.ok, false)
  assert.equal(res.error?.code, 'TEMPLATE_INVALID_EMBEDDED_CLAUSE_KIND')
})

test('createStandardTemplate rejects unknown universal embedded clause id (no template_clause writes)', async () => {
  const { trx, calls } = makeTrx({ universalIds: [] })
  const db = { transaction: async (fn) => fn(trx) }

  const svc = createStandardTemplatesService({ db })
  const content_json = {
    type: 'doc',
    content: [
      {
        type: 'embeddedUniversalClause',
        attrs: { clauseId: '00000000-0000-4000-8000-000000000099', clauseKind: 'universal' },
      },
    ],
  }

  const res = await svc.createStandardTemplate({
    name: 'P',
    code: 'PLANT-X',
    description: null,
    content_json,
    status: 'draft',
    document_type_id: 'dt1',
    actorUserProfileId: 'up1',
  })

  assert.equal(res.ok, false)
  assert.equal(res.error?.code, 'TEMPLATE_INVALID_EMBEDDED_CLAUSE')

  const joined = calls.map((c) => c.sql).join('\n')
  assert.ok(!joined.includes('template_clause'))
})

test('createStandardTemplate persists when embedded universal clause ids validate (no template_clause writes)', async () => {
  const embeddedId = '00000000-0000-4000-8000-000000000001'
  const { trx, calls } = makeTrx({ universalIds: [embeddedId] })
  const db = { transaction: async (fn) => fn(trx) }

  const svc = createStandardTemplatesService({ db })
  const content_json = {
    type: 'doc',
    content: [
      {
        type: 'embeddedUniversalClause',
        attrs: { clauseId: embeddedId, clauseKind: 'universal' },
      },
    ],
  }
  assert.deepEqual(collectEmbeddedClauseIdsFromDoc(content_json), [embeddedId])

  const res = await svc.createStandardTemplate({
    name: 'P',
    code: 'PLANT-X',
    description: null,
    content_json,
    status: 'draft',
    document_type_id: 'dt1',
    actorUserProfileId: 'up1',
  })

  assert.equal(res.ok, true)
  assert.ok(res.template?.id)

  const joined = calls.map((c) => c.sql).join('\n')
  assert.ok(!joined.includes('template_clause'))
})
