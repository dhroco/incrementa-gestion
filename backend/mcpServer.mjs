import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerMcpTools } from './mcpTools.mjs'

const require = createRequire(import.meta.url)

const { db } = require('./db/knex')
const { getUserProfileIdByUserId } = require('./services/profileService')
const supplierService = require('./services/supplierService')
const clientService = require('./services/clientService')
const { createStandardTemplatesService } = require('./services/standardTemplatesService')
const { createDocumentBuilderService } = require('./services/documentBuilderService')
const { gcsService } = require('./services/gcsService')
const { createContractsQueryService } = require('./services/contractsQueryService')
const { createContractSigningService } = require('./services/contractSigningService')
const emailService = require('./services/emailService')
const { tipTapDocToPlainTextAsync } = require('./utils/tipTapPlainText')

const standardTemplatesService = createStandardTemplatesService({ db })
const contractsQueryService = createContractsQueryService({ db, gcsService })
const contractSigningService = createContractSigningService({ db, gcsService, emailService })
const documentBuilderService = createDocumentBuilderService({
  db,
  gcsService,
  clientService,
  getUserProfileIdByUserId
})

const mcpDeps = {
  db,
  supplierService,
  clientService,
  standardTemplatesService,
  documentBuilderService,
  contractsQueryService,
  contractSigningService,
  gcsService,
  getUserProfileIdByUserId,
  tipTapDocToPlainTextAsync
}

/**
 * Creates a new McpServer with tools registered. Reuses the singleton Knex pool
 * and service instances from module scope (one pool for the process lifetime).
 */
export function createMcpServer() {
  const server = new McpServer({
    name: 'incrementa-gestion-mcp',
    version: '1.0.0'
  })

  registerMcpTools(server, mcpDeps)

  return { server, deps: mcpDeps }
}
