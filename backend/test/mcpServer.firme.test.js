const test = require('node:test')
const assert = require('node:assert/strict')

test('Factory passes the Firme signing service', async () => {
  const calls = []
  const original = global.setInterval
  global.setInterval = (...args) => {
    calls.push(args)
    return 0
  }
  try {
    const { createMcpServer } = await import('../mcpServer.mjs')
    const first = createMcpServer()
    const second = createMcpServer()
    assert.equal(typeof first.deps.firmeSigningService?.getSigningMode, 'function')
    assert.equal(typeof first.deps.firmeSigningService?.sweepPending, 'function')
    assert.equal(first.deps.db, second.deps.db)
    assert.equal(calls.length, 0)
  } finally {
    global.setInterval = original
  }
})
