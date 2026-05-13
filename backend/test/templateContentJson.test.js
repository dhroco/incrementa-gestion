const test = require('node:test')
const assert = require('node:assert/strict')
const { collectEmbeddedClauseIdsFromDoc, collectEmbeddedClauseRefsFromDoc } = require('../utils/templateContentJson')

test('collectEmbeddedClauseRefsFromDoc collects universal and company refs', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'embeddedUniversalClause',
        attrs: { clauseId: 'u1', clauseKind: 'universal' },
      },
      {
        type: 'embeddedUniversalClause',
        attrs: { clauseId: 'c1', clauseKind: 'company', companyId: 'co1' },
      },
    ],
  }
  const refs = collectEmbeddedClauseRefsFromDoc(doc)
  assert.equal(refs.length, 2)
  assert.deepEqual(refs[0], { clauseId: 'u1', clauseKind: 'universal', companyId: null })
  assert.deepEqual(refs[1], { clauseId: 'c1', clauseKind: 'company', companyId: 'co1' })
})

test('collectEmbeddedClauseIdsFromDoc only includes universal clause ids', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'embeddedUniversalClause', attrs: { clauseId: 'u1', clauseKind: 'universal' } },
      { type: 'embeddedUniversalClause', attrs: { clauseId: 'c1', clauseKind: 'company', companyId: 'co1' } },
    ],
  }
  const ids = collectEmbeddedClauseIdsFromDoc(doc)
  assert.deepEqual(ids, ['u1'])
})
