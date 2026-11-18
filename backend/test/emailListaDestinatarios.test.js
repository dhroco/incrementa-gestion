const test = require('node:test')
const assert = require('node:assert/strict')
const { parseEmailList, isValidEmailList } = require('../utils/emailList')

test('parseEmailList separa por coma, punto y coma y espacios, sin repetidas', () => {
  assert.deepEqual(parseEmailList('a@x.cl, b@x.cl;c@x.cl  A@X.cl'), ['a@x.cl', 'b@x.cl', 'c@x.cl'])
  assert.deepEqual(parseEmailList('solo@x.cl'), ['solo@x.cl'])
  assert.deepEqual(parseEmailList('  ,; '), [])
  assert.deepEqual(parseEmailList(null), [])
})

test('isValidEmailList exige todas válidas', () => {
  assert.equal(isValidEmailList('a@x.cl'), true)
  assert.equal(isValidEmailList('a@x.cl, b@y.com'), true)
  assert.equal(isValidEmailList('a@x.cl, malo'), false)
  assert.equal(isValidEmailList('bad'), false)
  assert.equal(isValidEmailList(''), false)
})
