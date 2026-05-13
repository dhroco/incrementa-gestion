const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')

describe('normalizeAuthEmail', () => {
  it('trims and lowercases', () => {
    assert.equal(normalizeAuthEmail('  DVD.Roco@Gmail.COM  '), 'dvd.roco@gmail.com')
  })

  it('handles nullish', () => {
    assert.equal(normalizeAuthEmail(null), '')
    assert.equal(normalizeAuthEmail(undefined), '')
  })
})
