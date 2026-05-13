const test = require('node:test')
const assert = require('node:assert/strict')
const { tipTapDocToPlainTextAsync } = require('../utils/tipTapPlainText')

test('tipTapDocToPlainTextAsync renders text and variables', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hola ' },
          { type: 'variable', attrs: { variableId: 'worker_name', label: 'Nombre', group: 'trabajador' } },
          { type: 'text', text: '.' }
        ]
      }
    ]
  }
  const out = await tipTapDocToPlainTextAsync(
    doc,
    async () => '',
    '00000000-0000-0000-0000-000000000000'
  )
  assert.match(out, /Hola \{\{worker_name\}\}/u)
})
