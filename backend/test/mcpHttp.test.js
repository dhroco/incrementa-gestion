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

const SECRETO = 'a'.repeat(20) + 'B'.repeat(12) + '_-9'

test('resolverRutaMcp: sin secreto fuera de prod usa /mcp', async () => {
  const { resolverRutaMcp } = await import('../mcp-http.mjs')
  assert.equal(resolverRutaMcp({ ENVIRONMENT: 'dev' }), '/mcp')
  assert.equal(resolverRutaMcp({ ENVIRONMENT: 'local', MCP_RUTA_SECRETA: '  ' }), '/mcp')
})

test('resolverRutaMcp: en prod exige el secreto', async () => {
  const { resolverRutaMcp } = await import('../mcp-http.mjs')
  assert.throws(() => resolverRutaMcp({ ENVIRONMENT: 'prod' }), /producción/)
  assert.equal(resolverRutaMcp({ ENVIRONMENT: 'prod', MCP_RUTA_SECRETA: SECRETO }), `/mcp/${SECRETO}`)
})

test('resolverRutaMcp: rechaza secretos cortos o con caracteres raros', async () => {
  const { resolverRutaMcp } = await import('../mcp-http.mjs')
  assert.throws(() => resolverRutaMcp({ ENVIRONMENT: 'prod', MCP_RUTA_SECRETA: 'corto' }), /32/)
  assert.throws(
    () => resolverRutaMcp({ ENVIRONMENT: 'dev', MCP_RUTA_SECRETA: 'x'.repeat(31) + '/../' }),
    /32/
  )
})

test('createApp con ruta secreta: /mcp no existe y la ruta secreta sí', async () => {
  const { createApp } = await import('../mcp-http.mjs')
  const app = createApp(`/mcp/${SECRETO}`)
  assert.equal((await request(app).get('/mcp')).status, 404)
  assert.equal((await request(app).post('/mcp').send({})).status, 404)
  assert.equal((await request(app).get(`/mcp/${SECRETO}x`)).status, 404)
  assert.equal((await request(app).get(`/mcp/${SECRETO}`)).status, 405)
  assert.equal((await request(app).get('/health')).status, 200)
})

test('ENVIRONMENT=prod con MCP_RUTA_SECRETA arranca (no sale con código 1)', async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP_HTTP_SCRIPT], {
      env: { ...process.env, ENVIRONMENT: 'prod', MCP_RUTA_SECRETA: SECRETO, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
    }, 1500)
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (/escuchando/.test(stderr)) {
        clearTimeout(timer)
        child.kill()
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      try {
        assert.notEqual(code, 1, stderr)
        assert.doesNotMatch(stderr, new RegExp(SECRETO))
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
