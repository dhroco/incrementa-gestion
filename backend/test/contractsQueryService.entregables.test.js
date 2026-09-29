const test = require('node:test')
const assert = require('node:assert/strict')

const { createContractsQueryService, mapContractListItem } = require('../services/contractsQueryService')

test('mapContractListItem includes servicios_entregables from contract_overrides', () => {
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
      precio_numero: '1.500.000',
      servicios_entregables: 'cinco (5) reels en TikTok'
    }
  })

  assert.equal(item.servicios_entregables, 'cinco (5) reels en TikTok')
  assert.equal(item.proveedor_red_social, 'Instagram')
  assert.equal(item.proveedor_cuenta_social, '@acme')
  assert.equal(item.precio_numero, '1.500.000')
})

test('mapContractListItem sets servicios_entregables to null when the key is absent', () => {
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
    contract_overrides: {
      fecha_contrato: '2025-01-01',
      mes_ejecucion: 'Enero 2025',
      proveedor_red_social: 'Instagram',
      proveedor_cuenta_social: '@acme',
      precio_numero: '100'
    }
  })

  assert.equal(item.servicios_entregables, null)
  assert.equal(item.fecha_contrato, '2025-01-01')
  assert.equal(item.mes_ejecucion, 'Enero 2025')
  assert.equal(item.proveedor_red_social, 'Instagram')
  assert.equal(item.proveedor_cuenta_social, '@acme')
  assert.equal(item.precio_numero, '100')
})

function ilike(value, pattern) {
  if (value == null) return false
  const needle = String(pattern).replace(/%/g, '').toLowerCase()
  return String(value).toLowerCase().includes(needle)
}

function rowMatchesSocial(row, group) {
  const overrides =
    row.contract_overrides && typeof row.contract_overrides === 'object' ? row.contract_overrides : {}
  let matched = null
  for (const part of group.parts) {
    let hit = false
    if (part.sql.includes("contract_overrides->>'proveedor_red_social'")) {
      hit = ilike(overrides.proveedor_red_social, part.bindings[0])
    } else if (part.sql.includes("contract_overrides->>'servicios_entregables'")) {
      hit = ilike(overrides.servicios_entregables, part.bindings[0])
    }
    if (part.op === 'or') matched = Boolean(matched) || hit
    else matched = matched === null ? hit : matched && hit
  }
  return Boolean(matched)
}

function createFilterDb(seedRows) {
  const groups = []

  function builder() {
    const api = {
      join() {
        return api
      },
      leftJoin() {
        return api
      },
      whereNot() {
        return api
      },
      select() {
        return api
      },
      where() {
        return api
      },
      whereILike() {
        return api
      },
      orWhereILike() {
        return api
      },
      andWhere(arg) {
        if (typeof arg === 'function') {
          const parts = []
          const inner = {
            whereRaw(sql, bindings) {
              parts.push({ op: 'and', sql, bindings: bindings.slice() })
              return inner
            },
            orWhereRaw(sql, bindings) {
              parts.push({ op: 'or', sql, bindings: bindings.slice() })
              return inner
            }
          }
          arg.call(inner)
          groups.push({ grouped: true, parts })
        }
        return api
      },
      unionAll() {
        return api
      }
    }
    return api
  }

  function socialGroups() {
    return groups.filter((group) =>
      group.parts.some(
        (part) =>
          part.sql.includes("contract_overrides->>'proveedor_red_social'") ||
          part.sql.includes("contract_overrides->>'servicios_entregables'")
      )
    )
  }

  function matched() {
    const [group] = socialGroups()
    if (!group) return seedRows
    return seedRows.filter((row) => rowMatchesSocial(row, group))
  }

  function knex() {
    return builder()
  }

  knex.raw = () => ({})
  knex.count = () => ({
    from() {
      return {
        first: async () => ({ count: matched().length })
      }
    }
  })
  knex.select = () => ({
    from() {
      return {
        orderBy() {
          return {
            limit() {
              return {
                offset: async () => matched().map((row) => structuredClone(row))
              }
            }
          }
        }
      }
    }
  })
  knex.groups = groups
  return knex
}

test('redSocialSearch matches a network named only in servicios_entregables', async () => {
  const tiktokOnly = {
    id: 'c-tiktok',
    source: 'draft',
    supplier_name: 'Ana',
    supplier_type: 'persona_natural',
    client_name: 'Marca',
    template_name: 'Contrato',
    file_name: 'a.pdf',
    gcs_path: 'contratos/a.pdf',
    status: 'draft',
    created_at: '2026-09-01T00:00:00.000Z',
    contract_overrides: {
      servicios_entregables: 'cinco (5) reels en TikTok',
      proveedor_red_social: null,
      proveedor_cuenta_social: null
    }
  }
  const instagram = {
    id: 'c-ig',
    source: 'draft',
    supplier_name: 'Bea',
    supplier_type: 'persona_natural',
    client_name: 'Marca',
    template_name: 'Contrato',
    file_name: 'b.pdf',
    gcs_path: 'contratos/b.pdf',
    status: 'draft',
    created_at: '2026-08-01T00:00:00.000Z',
    contract_overrides: {
      proveedor_red_social: 'Instagram',
      proveedor_cuenta_social: '@acme'
    }
  }
  const db = createFilterDb([tiktokOnly, instagram])
  const service = createContractsQueryService({ db, gcsService: {} })

  const result = await service.listContracts({
    page: 1,
    pageSize: 18,
    filters: { redSocialSearch: 'TikTok' }
  })

  assert.deepEqual(
    result.data.items.map((item) => item.id),
    ['c-tiktok']
  )
  assert.equal(result.data.items[0].servicios_entregables, 'cinco (5) reels en TikTok')
  assert.equal(result.data.pagination.total, 1)

  const socialGroups = db.groups.filter((group) => group.grouped)
  assert.equal(socialGroups.length >= 1, true)
  for (const group of socialGroups) {
    assert.equal(group.parts.length, 2)
    assert.match(group.parts[0].sql, /contract_overrides->>'proveedor_red_social' ILIKE \?/)
    assert.match(group.parts[1].sql, /contract_overrides->>'servicios_entregables' ILIKE \?/)
    assert.equal(group.parts[0].op, 'and')
    assert.equal(group.parts[1].op, 'or')
    assert.deepEqual(group.parts[0].bindings, ['%TikTok%'])
    assert.deepEqual(group.parts[1].bindings, ['%TikTok%'])
  }
})
