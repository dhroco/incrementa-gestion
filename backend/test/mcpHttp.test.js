const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')
const request = require('supertest')

const MCP_HTTP_SCRIPT = path.join(__dirname, '../mcp-http.mjs')

test('GET /health returns 200 with status ok', async () => {
  const { app } = await import('../mcp-http.mjs')
  const res = await request(app).get('/health')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { status: 'ok' })
})

test('GET /mcp returns 405 in stateless mode', async () => {
  const { app } = await import('../mcp-http.mjs')
  const res = await request(app).get('/mcp')
  assert.equal(res.status, 405)
  const body = JSON.parse(res.text)
  assert.equal(body.error.code, -32000)
  assert.match(body.error.message, /not allowed/i)
})

test('DELETE /mcp returns 405 in stateless mode', async () => {
  const { app } = await import('../mcp-http.mjs')
  const res = await request(app).delete('/mcp')
  assert.equal(res.status, 405)
  const body = JSON.parse(res.text)
  assert.equal(body.error.code, -32000)
})

test('ENVIRONMENT=prod exits with code 1 before listening', async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP_HTTP_SCRIPT], {
      env: { ...process.env, ENVIRONMENT: 'prod' },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', (code) => {
      try {
        assert.equal(code, 1)
        assert.match(stderr, /producción|prod/i)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
})

test('createMcpServer reuses singleton db instance', async () => {
  const { createMcpServer } = await import('../mcpServer.mjs')
  const { db: knexSingleton } = require('../db/knex')

  const first = createMcpServer()
  const second = createMcpServer()

  assert.notEqual(first.server, second.server)
  assert.equal(first.deps.db, knexSingleton)
  assert.equal(second.deps.db, knexSingleton)
  assert.equal(first.deps.db, second.deps.db)
})
