function _toCount(row) {
  if (!row || row.count == null) return 0
  const n = Number(row.count)
  return Number.isFinite(n) ? n : 0
}

function createDashboardService({ db }) {
  async function getDashboardStats() {
    const [
      supplierTotalRow,
      personaNaturalRow,
      empresaRow,
      draftPendingRow,
      signedTotalRow,
      activeTotalRow,
      mostRecentRow
    ] = await Promise.all([
      db('supplier').count('* as count').first(),
      db('supplier').where('supplier_type', 'persona_natural').count('* as count').first(),
      db('supplier').where('supplier_type', 'empresa').count('* as count').first(),
      db('draft_document').where('status', 'draft').count('* as count').first(),
      db('document').count('* as count').first(),
      db('template as t')
        .join('template_standard as ts', 'ts.id', 't.id')
        .where('t.status', 'active')
        .count('* as count')
        .first(),
      db('template as t')
        .join('template_standard as ts', 'ts.id', 't.id')
        .where('t.status', 'active')
        .select('t.name')
        .orderBy('t.created_at', 'desc')
        .first()
    ])

    return {
      ok: true,
      data: {
        suppliers: {
          total: _toCount(supplierTotalRow),
          personaNatural: _toCount(personaNaturalRow),
          empresa: _toCount(empresaRow)
        },
        contracts: {
          draftPending: _toCount(draftPendingRow),
          signedTotal: _toCount(signedTotalRow)
        },
        templates: {
          activeTotal: _toCount(activeTotalRow),
          mostRecentName: typeof mostRecentRow?.name === 'string' ? mostRecentRow.name : null
        }
      }
    }
  }

  return { getDashboardStats }
}

module.exports = { createDashboardService, _toCount }
