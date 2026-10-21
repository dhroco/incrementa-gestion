import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './mcpServer.mjs'

const require = createRequire(import.meta.url)
const config = require('./config')

/**
 * Ruta donde atiende el MCP.
 *
 * - Sin MCP_RUTA_SECRETA: `/mcp` (pre-prod y local, como siempre).
 * - Con MCP_RUTA_SECRETA: `/mcp/<secreto>`, y `/mcp` sola no existe.
 * - En producción (ENVIRONMENT=prod) el secreto es obligatorio: el MCP no tiene login todavía
 *   (marcha blanca, opción 2), así que solo atiende en una ruta imposible de adivinar, guardada
 *   en Key Vault, y la ingress de Azure solo deja pasar a Anthropic. El destino es el MCP con
 *   login de Entra (opción 1); cuando exista, esta ruta se apaga.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolverRutaMcp(env) {
  const secreto = (env.MCP_RUTA_SECRETA || '').trim()
  if (!secreto) {
    if (env.ENVIRONMENT === 'prod') {
      throw new Error(
        'el servidor MCP HTTP abierto no está permitido en producción (ENVIRONMENT=prod) sin MCP_RUTA_SECRETA'
      )
    }
    return '/mcp'
  }
  if (!/^[A-Za-z0-9_-]{32,}$/.test(secreto)) {
    throw new Error('MCP_RUTA_SECRETA debe tener al menos 32 caracteres [A-Za-z0-9_-]')
  }
  return `/mcp/${secreto}`
}

let rutaMcp
try {
  rutaMcp = resolverRutaMcp({ ...process.env, ENVIRONMENT: config.ENVIRONMENT })
} catch (error) {
  console.error(`mcp-http.mjs: ${error.message}`)
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

async function handleMcpPost(req, res) {
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
}

/**
 * @param {string} ruta  ruta del MCP (ver resolverRutaMcp)
 */
export function createApp(ruta) {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  app.get(ruta, respondMethodNotAllowed)
  app.delete(ruta, respondMethodNotAllowed)
  app.post(ruta, handleMcpPost)

  return app
}

const app = createApp(rutaMcp)

const PORT = Number(process.env.PORT) || 8080
const HOST = '0.0.0.0'

const __filename = fileURLToPath(import.meta.url)
const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)

if (isMainModule) {
  app.listen(PORT, HOST, () => {
    const visible = rutaMcp === '/mcp' ? '/mcp' : '/mcp/<MCP_RUTA_SECRETA>'
    console.error(`MCP HTTP escuchando en http://${HOST}:${PORT}${visible}`)
  })
}

export { app }
