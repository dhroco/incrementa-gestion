import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchCompanyClausesList } from '../api/clausesApi'
import { selectEnrichedNavigation, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { selectAssignedCompanies, selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { formatLastChangeDate } from '../utils/lastChangeDate'
import { listRowLastEditorLabel } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import './ClauseForm.css'

function truncate(s, max = 80) {
  if (!s || typeof s !== 'string') return '—'
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function ClauseCompanyListPage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const navigation = useSelector(selectEnrichedNavigation)
  const profile = useSelector(selectEnrichedProfile)
  const canEditClauses = useMemo(
    () => buildGrantedCodeSetFromSession(navigation).has('NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT'),
    [navigation]
  )
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  const isAccountant = profile?.code === 'CONTADOR'
  const blockedNoCompany = isAccountant && assignedCompanies.length === 0

  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' })
  const [widths, setWidths] = useState({})

  const showCompanyColumn = useMemo(() => {
    const ids = items.map((r) => r?.company_id).filter(Boolean)
    return new Set(ids).size > 1
  }, [items])

  const cols = useMemo(() => {
    const base = []
    if (showCompanyColumn) base.push({ key: 'company_business_name', label: 'Empresa', sortable: true })
    base.push(
      { key: 'code', label: 'Código', sortable: true },
      { key: 'title_clause', label: 'Título', sortable: true },
      { key: 'description', label: 'Descripción', sortable: true },
      { key: 'status', label: 'Estado', sortable: true },
      { key: 'last_editor', label: 'Último editor', sortable: true },
      { key: 'updated_at', label: 'Último cambio', sortable: true },
      { key: 'actions', label: 'Acciones', sortable: false, className: 'clause-list-col-actions' }
    )
    return base
  }, [showCompanyColumn])

  const sortedItems = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : []
    const dir = sort?.dir === 'desc' ? -1 : 1
    const key = sort?.key || 'code'
    const normStr = (v) => (v == null ? '' : String(v))

    const getValue = (row) => {
      if (!row || typeof row !== 'object') return ''
      if (key === 'last_editor') return normStr(listRowLastEditorLabel(row))
      if (key === 'title_clause') return normStr(row.title_clause)
      if (key === 'description') return normStr(row.description)
      if (key === 'status') return normStr(mapClauseStatusToSpanish(row.status))
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
      if (!accessToken) {
        setLoading(false)
        setItems([])
        return
      }
      if (blockedNoCompany) {
        setLoading(false)
        setError(null)
        setItems([])
        return
      }
      if (isAccountant && !selectedCompanyId) {
        setLoading(true)
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchCompanyClausesList({
        q,
        accessToken,
        companyId: isAccountant ? selectedCompanyId : undefined
      })
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
  }, [q, accessToken, blockedNoCompany, isAccountant, selectedCompanyId])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="clause-company-search"
          placeholder="Buscar por título, código o descripción..."
          ariaLabel="Buscar cláusulas por empresa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={isAccountant && !selectedCompanyId}
        />
        <button type="button" className="clause-button" onClick={() => navigate('nueva')}>
          Nueva cláusula
        </button>
      </>
    ),
    [isAccountant, navigate, q, selectedCompanyId]
  )

  if (blockedNoCompany) {
    return (
      <PageShell title="Catálogo de cláusulas aplicables" className="clause-universal-list-page">
        <div className="clause-list-card">
          <div className="clause-error">Usted no tiene una empresa asignada</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Catálogo de cláusulas aplicables" actions={listToolbar} className="clause-universal-list-page">
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
                    <td colSpan={showCompanyColumn ? 8 : 7} className="clause-list-empty">
                      {q.trim()
                        ? 'No hay cláusulas que coincidan con la búsqueda.'
                        : 'No hay cláusulas por empresa registradas.'}
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((row) => (
                    <tr key={row.id}>
                      {showCompanyColumn ? <td>{row.company_business_name ?? '—'}</td> : null}
                      <td>{row.code ?? '—'}</td>
                      <td>{row.title_clause ?? '—'}</td>
                      <td>{truncate(row.description, 100)}</td>
                      <td>{mapClauseStatusToSpanish(row.status)}</td>
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
                        {canEditClauses ? (
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

