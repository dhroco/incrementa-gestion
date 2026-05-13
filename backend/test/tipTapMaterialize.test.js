const test = require('node:test')
const assert = require('node:assert/strict')
const { materializeTipTapDocAsync } = require('../utils/tipTapMaterialize')

test('materializeTipTapDocAsync inlines embedded clause blocks', async () => {
  const template = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
      {
        type: 'embeddedUniversalClause',
        attrs: { clauseId: 'c1', clauseKind: 'universal' }
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'Outro' }] }
    ]
  }
  const clauseDoc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Cláusula' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Título' }] }
    ]
  }
  const merged = await materializeTipTapDocAsync(
    template,
    async ({ clauseId }) => (clauseId === 'c1' ? clauseDoc : null),
    'co1'
  )
  assert.equal(merged.type, 'doc')
  assert.equal(merged.content.length, 4)
  assert.equal(merged.content[0].type, 'paragraph')
  assert.equal(merged.content[1].type, 'paragraph')
  assert.equal(merged.content[1].content[0].text, 'Cláusula')
  assert.equal(merged.content[2].type, 'heading')
  assert.equal(merged.content[3].type, 'paragraph')
})
