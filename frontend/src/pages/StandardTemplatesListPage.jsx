import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchStandardTemplatesList } from '../api/standardTemplatesApi'
import { AbilityContext } from '../lib/ability'
import { formatLastChangeDate } from '../utils/lastChangeDate'
import { listRowLastEditorLabel } from '../utils/auditMetadataDisplay'
import { mapTemplateStatusToSpanish } from '../utils/templateStatus'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import '../styles/shared-form.css'

function truncate(s, max = 80) {
  if (!s || typeof s !== 'string') return '—'
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function StandardTemplatesListPage() {
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)

  const canEditTemplates = ability.can('update', 'Template')
  const canCreateTemplates = ability.can('create', 'Template')

  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' })
  const [widths, setWidths] = useState({})

  const cols = useMemo(
    () => [
      { key: 'code', label: 'Código', sortable: true },
      { key: 'name', label: 'Nombre', sortable: true },
      { key: 'description', label: 'Descripción', sortable: true },
      { key: 'supplier_type', label: 'Tipo de proveedor', sortable: true },
      { key: 'status', label: 'Estado', sortable: true },
      { key: 'last_editor', label: 'Último editor', sortable: true },
      { key: 'updated_at', label: 'Último cambio', sortable: true },
      { key: 'actions', label: 'Acciones', sortable: false, className: 'clause-list-col-actions' },
    ],
    []
  )

  const sortedItems = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : []
    const dir = sort?.dir === 'desc' ? -1 : 1
    const key = sort?.key || 'code'
    const normStr = (v) => (v == null ? '' : String(v))

    const getValue = (row) => {
      if (!row || typeof row !== 'object') return ''
      if (key === 'last_editor') return normStr(listRowLastEditorLabel(row))
      if (key === 'description') return normStr(row.description)
      if (key === 'supplier_type') {
        return row.supplier_type === 'empresa' ? 'Empresa' : 'Persona Natural'
      }
      if (key === 'status') return normStr(mapTemplateStatusToSpanish(row.status))
      if (key === 'updated_at') return row.updated_at ? new Date(row.updated_at).getTime() : 0
      return normStr(row[key])
    }

    list.sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return normStr(av).localeCompare(normStr(bv), 'es', { numeric: true, sensitivity: 'base' }) * dir
    })
    return list
  }, [items, sort])

  const beginResize = (key, e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = Number(widths[key] || 0)
    const fallback = e.currentTarget?.parentElement?.getBoundingClientRect?.().width
    const baseWidth = startWidth || (typeof fallback === 'number' ? fallback : 160)

    const onMove = (ev) => {
      const next = Math.max(60, Math.round(baseWidth + (ev.clientX - startX)))
      setWidths((w) => ({ ...w, [key]: next }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const toggleSort = (key) => {
    setSort((s) => {
      if (s?.key === key) return { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      return { key, dir: 'asc' }
    })
  }

  useEffect(() => {
    let active = true
    async function run() {
      setLoading(true)
      setError(null)
      const res = await fetchStandardTemplatesList({ q })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el listado.')
        setItems([])
        return
      }
      const list = res.data?.items
      setItems(Array.isArray(list) ? list : [])
    }
    run()
    return () => {
      active = false
    }
  }, [])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="standard-templates-search"
          placeholder="Buscar por nombre, código o descripción..."
          ariaLabel="Buscar plantillas estándar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canCreateTemplates ? (
          <button type="button" className="btn" onClick={() => navigate('nueva')}>
            Nueva plantilla
          </button>
        ) : null}
      </>
    ),
    [canCreateTemplates, navigate, q]
  )

  return (
    <PageShell
      title="Catálogo de plantillas estándar aplicables a todos los contratos"
      actions={listToolbar}
      className="clause-universal-list-page"
    >
      <div className="clause-list-card">
        {error ? <div className="clause-error">{error}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <div className="clause-list-table-wrap">
            <table className="clause-list-table">
              <colgroup>
                {cols.map((c) => (
                  <col key={c.key} style={widths[c.key] ? { width: `${widths[c.key]}px` } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className={`${c.className || ''} clause-list-th`.trim()}>
                      {c.sortable ? (
                        <button type="button" className="clause-list-th-button" onClick={() => toggleSort(c.key)}>
                          {c.label}
                        </button>
                      ) : (
                        c.label
                      )}
                      {c.key !== 'actions' ? (
                        <span
                          className="clause-list-th-resizer"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Ajustar ancho columna ${c.label}`}
                          onMouseDown={(e) => beginResize(c.key, e)}
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="clause-list-empty">
                      {q.trim()
                        ? 'No hay plantillas que coincidan con la búsqueda.'
                        : 'No hay plantillas estándar registradas.'}
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((row) => (
                    <tr key={row.id}>
                      <td>{row.code ?? '—'}</td>
                      <td>{row.name ?? '—'}</td>
                      <td>{truncate(row.description, 100)}</td>
                      <td>
                        <SupplierTypeChip supplierType={row.supplier_type} />
                      </td>
                      <td>{mapTemplateStatusToSpanish(row.status)}</td>
                      <td>{listRowLastEditorLabel(row)}</td>
                      <td>{formatLastChangeDate(row.updated_at)}</td>
                      <td className="clause-list-col-actions">
                        <button
                          type="button"
                          className="clause-link-button"
                          onClick={() => navigate(`${row.id}`)}
                        >
                          Ver
                        </button>
                        {canEditTemplates ? (
                          <button
                            type="button"
                            className="clause-link-button"
                            onClick={() => navigate(`${row.id}/edit`)}
                          >
                            Editar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  )
}
