const test = require('node:test')
const assert = require('node:assert/strict')
const { extractAuthEmailFromPayload } = require('../middleware/requireOidcAuth')

test('extractAuthEmailFromPayload uses email claim when present', () => {
  assert.equal(
    extractAuthEmailFromPayload({ email: '  User@Example.com  ' }),
    'user@example.com'
  )
})

test('extractAuthEmailFromPayload falls back to preferred_username', () => {
  assert.equal(
    extractAuthEmailFromPayload({ preferred_username: 'User@Example.com' }),
    'user@example.com'
  )
})

test('extractAuthEmailFromPayload prefers email over preferred_username', () => {
  assert.equal(
    extractAuthEmailFromPayload({
      email: 'primary@example.com',
      preferred_username: 'secondary@example.com'
    }),
    'primary@example.com'
  )
})

test('extractAuthEmailFromPayload returns null when no email claims', () => {
  assert.equal(extractAuthEmailFromPayload({}), null)
  assert.equal(extractAuthEmailFromPayload({ email: 123 }), null)
  assert.equal(extractAuthEmailFromPayload({ preferred_username: '' }), null)
})
