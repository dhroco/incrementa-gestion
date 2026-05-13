const test = require('node:test')
const assert = require('node:assert/strict')
const { validateClauseContentJson } = require('../utils/clauseContentJson')

const validDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

test('validateClauseContentJson accepts minimal TipTap doc', () => {
  const r = validateClauseContentJson(validDoc, { required: true })
  assert.equal(r.ok, true)
})

test('validateClauseContentJson rejects empty content array', () => {
  const r = validateClauseContentJson({ type: 'doc', content: [] }, { required: true })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'CLAUSE_EMPTY_CONTENT')
})

test('validateClauseContentJson rejects missing value when required', () => {
  const r = validateClauseContentJson(undefined, { required: true })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'CLAUSE_CONTENT_JSON_REQUIRED')
})
