const test = require('node:test')
const assert = require('node:assert/strict')

function createMockServer() {
  const tools = new Map()
  return {
    tool(name, description) {
      tools.set(name, { description })
    },
    getTool(name) {
      return tools.get(name)
    }
  }
}

test('Description lists dynamic text and forbids drafting it', async () => {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const server = createMockServer()
  registerMcpTools(server, {
    db: {},
    supplierService: {},
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: {},
    contractSigningService: {},
    gcsService: {},
    getUserProfileIdByUserId: async () => null
  })

  const validateTool = server.getTool('validar_contrato')
  assert.ok(validateTool.description.includes('dynamic_text'))
  assert.ok(validateTool.description.includes('type (text/date/select/number/dynamic_text)'))
  assert.ok(
    validateTool.description.includes(
      'PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia'
    )
  )
  assert.ok(validateTool.description.includes('NO genera PDF'))
  assert.ok(validateTool.description.includes('PROHIBIDO elegir por cuenta propia'))
  assert.ok(validateTool.description.includes('pairField'))

  const generateTool = server.getTool('generar_contrato')
  assert.ok(generateTool.description.includes('confirmación explícita'))
  assert.equal(generateTool.description.includes('dynamic_text'), false)
})
