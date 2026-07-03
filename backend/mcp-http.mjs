import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './mcpServer.mjs'

const require = createRequire(import.meta.url)
const config = require('./config')

if (config.ENVIRONMENT === 'prod') {
  console.error(
    'mcp-http.mjs: el servidor MCP HTTP abierto no está permitido en producción (ENVIRONMENT=prod)'
  )
  process.exit(1)
}

const METHOD_NOT_ALLOWED_BODY = JSON.stringify({
  jsonrpc: '2.0',
  error: {
    code: -32000,
    message: 'Method not allowed.'
  },
  id: null
})

function respondMethodNotAllowed(_req, res) {
  res.writeHead(405).end(METHOD_NOT_ALLOWED_BODY)
}

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/mcp', respondMethodNotAllowed)
app.delete('/mcp', respondMethodNotAllowed)

app.post('/mcp', async (req, res) => {
  const { server } = createMcpServer()

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    })

    // Registrar la limpieza ANTES de handleRequest: si la respuesta se cierra
    // durante el procesamiento, el evento 'close' ya habría pasado si se registrara después.
    res.on('close', () => {
      transport.close()
      server.close?.()
    })

    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    console.error('Error al procesar solicitud MCP:', error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      })
    }
  }
})

const PORT = Number(process.env.PORT) || 8080
const HOST = '0.0.0.0'

const __filename = fileURLToPath(import.meta.url)
const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)

if (isMainModule) {
  app.listen(PORT, HOST, () => {
    console.error(`MCP HTTP escuchando en http://${HOST}:${PORT}`)
  })
}

export { app }
