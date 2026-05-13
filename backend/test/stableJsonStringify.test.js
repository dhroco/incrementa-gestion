const test = require('node:test')
const assert = require('node:assert/strict')
const { stableJsonStringify } = require('../lib/stableJsonStringify')

test('stableJsonStringify matches for equivalent objects', () => {
  assert.equal(stableJsonStringify({ a: 1 }), stableJsonStringify({ a: 1 }))
})

test('stableJsonStringify differs when content differs', () => {
  assert.notEqual(stableJsonStringify({ a: 1 }), stableJsonStringify({ a: 2 }))
})
