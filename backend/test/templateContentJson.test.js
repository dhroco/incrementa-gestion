const test = require('node:test')
const assert = require('node:assert/strict')
const { validateTemplateContentJson } = require('../utils/templateContentJson')

test('validateTemplateContentJson accepts a non-empty doc', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  assert.deepEqual(validateTemplateContentJson(doc), { ok: true })
})

test('validateTemplateContentJson rejects missing doc when required', () => {
  const result = validateTemplateContentJson(null, { required: true })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TEMPLATE_CONTENT_JSON_REQUIRED')
})

test('validateTemplateContentJson rejects empty content array', () => {
  const result = validateTemplateContentJson({ type: 'doc', content: [] })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TEMPLATE_EMPTY_CONTENT')
})

test('validateTemplateContentJson rejects non-doc root', () => {
  const result = validateTemplateContentJson({ type: 'paragraph', content: [] })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TEMPLATE_INVALID_CONTENT_JSON')
})
