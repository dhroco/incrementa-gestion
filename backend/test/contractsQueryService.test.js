const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createContractsQueryService,
  mapContractListItem,
  normalizeFilters
} = require('../services/contractsQueryService')
test('mapContractListItem maps override fields from contract_overrides', () => {
  const item = mapContractListItem({
    id: 'c1',
    source: 'draft',
    supplier_name: 'Acme SpA',
    supplier_type: 'empresa',
    client_name: 'Marca X',
    template_name: 'Contrato servicios',
    file_name: 'contrato.pdf',
    gcs_path: 'contratos/x/y.pdf',
    status: 'draft',
    created_at: '2026-05-01T12:00:00.000Z',
    contract_overrides: {
      fecha_contrato: '2026-05-01',
      mes_ejecucion: 'Mayo 2026',
      proveedor_red_social: 'Instagram',
      proveedor_cuenta_social: '@acme',
      precio_numero: '1.500.000'
    }
  })

  assert.equal(item.id, 'c1')
  assert.equal(item.source, 'draft')
  assert.equal(item.fecha_contrato, '2026-05-01')
  assert.equal(item.mes_ejecucion, 'Mayo 2026')
  assert.equal(item.proveedor_red_social, 'Instagram')
  assert.equal(item.proveedor_cuenta_social, '@acme')
  assert.equal(item.precio_numero, '1.500.000')
})

test('mapContractListItem handles null contract_overrides', () => {
  const item = mapContractListItem({
    id: 'c2',
    source: 'signed',
    supplier_name: 'Juan Pérez',
    supplier_type: 'persona_natural',
    client_name: null,
    template_name: null,
    file_name: 'old.pdf',
    gcs_path: 'contratos/old.pdf',
    status: 'signed',
    created_at: '2025-01-01T00:00:00.000Z',
    contract_overrides: null
  })

  assert.equal(item.fecha_contrato, null)
  assert.equal(item.mes_ejecucion, null)
  assert.equal(item.proveedor_red_social, null)
  assert.equal(item.proveedor_cuenta_social, null)
  assert.equal(item.precio_numero, null)
})

test('normalizeFilters defaults status to all and trims strings', () => {
  const filters = normalizeFilters({
    supplierSearch: '  acme  ',
    clientId: '  ',
    templateId: 'tpl-1',
    redSocialSearch: ' insta ',
    status: 'DRAFT'
  })

  assert.equal(filters.supplierSearch, 'acme')
  assert.equal(filters.clientId, null)
  assert.equal(filters.templateId, 'tpl-1')
  assert.equal(filters.redSocialSearch, 'insta')
  assert.equal(filters.status, 'draft')
})

test('normalizeFilters rejects invalid status', () => {
  const filters = normalizeFilters({ status: 'unknown' })
  assert.equal(filters.status, 'all')
})

test('getContractPdf loads signed document without status column', async () => {
  let documentColumns = null
  const db = (table) => {
    if (table === 'document') {
      return {
        select(cols) {
          documentColumns = cols
          return {
            where() {
              return {
                first: async () => ({
                  id: 'doc1',
                  file_name: 'firmado.pdf',
                  gcs_path: 'contratos-firmados/x.pdf'
                })
              }
            }
          }
        }
      }
    }
    return {}
  }

  const gcsService = {
    downloadBuffer: async () => Buffer.from('%PDF')
  }

  const service = createContractsQueryService({ db, gcsService })
  const result = await service.getContractPdf({ id: 'doc1', source: 'signed' })

  assert.equal(result.ok, true)
  assert.deepEqual(documentColumns, ['id', 'file_name', 'gcs_path'])
  assert.equal(result.data.file_name, 'firmado.pdf')
})
