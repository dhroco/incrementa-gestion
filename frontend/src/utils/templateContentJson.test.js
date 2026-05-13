import { describe, expect, it } from 'vitest'
import { collectEmbeddedClauseIdsFromDoc } from './templateContentJson'

describe('collectEmbeddedClauseIdsFromDoc', () => {
  it('ignores company-kind embedded nodes for universal-id collection', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'embeddedUniversalClause', attrs: { clauseId: 'u1', clauseKind: 'universal' } },
        { type: 'embeddedUniversalClause', attrs: { clauseId: 'c1', clauseKind: 'company', companyId: 'co1' } },
      ],
    }
    expect(collectEmbeddedClauseIdsFromDoc(doc)).toEqual(['u1'])
  })
})
