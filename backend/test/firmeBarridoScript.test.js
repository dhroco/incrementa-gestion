const test = require('node:test')
const assert = require('node:assert/strict')

const { runBarrido } = require('../scripts/firme-barrido')

function capture() {
  const out = []
  const err = []
  return {
    out,
    err,
    stdout: { write(chunk) { out.push(String(chunk)) } },
    stderr: { write(chunk) { err.push(String(chunk)) } }
  }
}

test('the sweep script skips an unconfigured Firme', async () => {
  const io = capture()
  let swept = false
  let destroyed = false
  const code = await runBarrido({
    configured: () => false,
    sweepPending: async () => {
      swept = true
      return {}
    },
    destroy: async () => {
      destroyed = true
    },
    stdout: io.stdout,
    stderr: io.stderr
  })
  assert.equal(code, 0)
  assert.equal(swept, false)
  assert.equal(destroyed, true)
  assert.equal(io.out.join(''), '{ "ok": true, "omitido": "Firme no está configurado" }\n')
})

test('the sweep script prints one summary line', async () => {
  const io = capture()
  let destroyed = false
  const summary = { revisados: 2, finalizados: 1, rechazados: 0, vencidos: 0, saltados: 1, errores: 0 }
  const code = await runBarrido({
    configured: () => true,
    sweepPending: async () => summary,
    destroy: async () => {
      destroyed = true
    },
    stdout: io.stdout,
    stderr: io.stderr
  })
  assert.equal(code, 0)
  assert.equal(destroyed, true)
  assert.equal(io.out.length, 1)
  assert.deepEqual(JSON.parse(io.out[0]), summary)
  assert.equal(io.out[0].includes('signee'), false)
  assert.equal(io.out[0].includes('token'), false)
})

test('the sweep script exits 1 on failure', async () => {
  const io = capture()
  let destroyed = false
  const code = await runBarrido({
    configured: () => true,
    sweepPending: async () => {
      const err = new Error('db')
      err.code = 'BARRIDO_FAILED'
      throw err
    },
    destroy: async () => {
      destroyed = true
    },
    stdout: io.stdout,
    stderr: io.stderr
  })
  assert.equal(code, 1)
  assert.equal(destroyed, true)
  assert.equal(io.err.join(''), 'BARRIDO_FAILED\n')
})
