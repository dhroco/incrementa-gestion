const test = require('node:test')
const assert = require('node:assert/strict')

const { runWebhook, EVENT_TYPES } = require('../scripts/firme-webhook')

const TOKEN = 'sekret-token-no-imprimir'

function capture() {
  const lines = []
  return { lines, write: (line) => lines.push(line) }
}

test('registrar replaces a different subscription for the same URL', async () => {
  const io = capture()
  const deleted = []
  const created = []
  const sleeps = []
  let polls = 0
  const code = await runWebhook({
    argv: ['registrar', 'https://app.example/api/webhooks/firme'],
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    write: io.write,
    client: {
      token: TOKEN,
      async listWebhooks() {
        return [
          { id: 'old-1', url: 'https://app.example/api/webhooks/firme', eventTypes: ['document.signed'] },
          { id: 'keep', url: 'https://otra.example/hook', eventTypes: ['document.signed'] },
          { id: 'same', url: 'https://app.example/api/webhooks/firme', eventTypes: [...EVENT_TYPES] }
        ]
      },
      async deleteWebhook(id) {
        deleted.push(id)
      },
      async createWebhook(input) {
        created.push(input)
        return { id: 'new-1' }
      },
      async getWebhook() {
        polls += 1
        return polls < 2 ? { isConfirmed: false, status: 'pending' } : { isConfirmed: true, status: 'confirmed' }
      }
    }
  })
  assert.equal(code, 0)
  assert.deepEqual(deleted, ['old-1'])
  assert.deepEqual(created[0].eventTypes, [...EVENT_TYPES])
  assert.deepEqual(sleeps, [3000])
  assert.equal(io.lines.join(''), 'new-1 confirmed\n')
  assert.equal(io.lines.join('').includes(TOKEN), false)
})

test('a webhook 403 names the administrator token', async () => {
  const io = capture()
  const err = new Error(`HTTP 403 ${TOKEN}`)
  err.status = 403
  const code = await runWebhook({
    argv: ['registrar', 'https://app.example/api/webhooks/firme'],
    write: io.write,
    client: {
      async listWebhooks() {
        throw err
      }
    }
  })
  assert.equal(code, 1)
  assert.match(io.lines.join(''), /administrador/)
  assert.equal(io.lines.join('').includes(TOKEN), false)
})

test('listar, borrar and estado print ids without the token', async () => {
  const listed = capture()
  const deleted = []
  const client = {
    token: TOKEN,
    async listWebhooks() {
      return [{ id: 'sub-1', url: 'https://app.example/hook', eventTypes: ['document.signed'] }]
    },
    async deleteWebhook(id) {
      deleted.push(id)
    },
    async getWebhook(id) {
      return { id, status: 'confirmed', isConfirmed: true }
    }
  }
  assert.equal(await runWebhook({ argv: ['listar'], client, write: listed.write }), 0)
  assert.match(listed.lines.join(''), /sub-1/)
  assert.equal(listed.lines.join('').includes(TOKEN), false)

  const removed = capture()
  assert.equal(await runWebhook({ argv: ['borrar', 'sub-1'], client, write: removed.write }), 0)
  assert.deepEqual(deleted, ['sub-1'])

  const status = capture()
  assert.equal(await runWebhook({ argv: ['estado', 'sub-1'], client, write: status.write }), 0)
  assert.equal(status.lines.join(''), 'sub-1 confirmed\n')
})
