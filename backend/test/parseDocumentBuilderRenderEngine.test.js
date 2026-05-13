const test = require('node:test')
const assert = require('node:assert/strict')
const { parseDocumentBuilderRenderEngine } = require('../lib/parseDocumentBuilderRenderEngine')

test('parse: omit renderEngine -> pdf-lib / pdf_lib', () => {
  const r = parseDocumentBuilderRenderEngine({ employeeIds: [] })
  assert.equal(r.ok, true)
  assert.equal(r.input, 'pdf-lib')
  assert.equal(r.storage, 'pdf_lib')
})

test('parse: null/empty string -> default', () => {
  const r1 = parseDocumentBuilderRenderEngine({ renderEngine: null })
  assert.equal(r1.ok, true)
  assert.equal(r1.storage, 'pdf_lib')
  const r2 = parseDocumentBuilderRenderEngine({ renderEngine: '' })
  assert.equal(r2.storage, 'pdf_lib')
})

test('parse: react-pdf', () => {
  const r = parseDocumentBuilderRenderEngine({ renderEngine: 'react-pdf' })
  assert.equal(r.ok, true)
  assert.equal(r.input, 'react-pdf')
  assert.equal(r.storage, 'react_pdf')
})

test('parse: invalid', () => {
  const r = parseDocumentBuilderRenderEngine({ renderEngine: 'nope' })
  assert.equal(r.ok, false)
  assert.match(String(r.message), /inválido/i)
})
