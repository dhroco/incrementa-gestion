import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchCompanyTemplatesList } from '../api/companyTemplatesApi'
import { selectEnrichedCompany, selectEnrichedNavigation, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { selectAssignedCompanies, selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { formatLastChangeDate } from '../utils/lastChangeDate'
import { listRowLastEditorLabel } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import './ClauseForm.css'

/** Título de pantalla alineado al ítem de menú en seed (`NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA`). */
const PAGE_TITLE = 'Templates por empresa'

function truncate(s, max = 80) {
  if (!s || typeof s !== 'string') return '—'
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function useEffectiveCompanyIdForTemplates() {
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const isAccountant = profile?.code === 'CONTADOR'
  const blockedNoCompany = isAccountant && assignedCompanies.length === 0
  const companyAdminId =
    profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR' && enrichedCompany?.id ? enrichedCompany.id : null
  const effectiveId = isAccountant ? selectedCompanyId : companyAdminId
  return { effectiveId, isAccountant, blockedNoCompany }
}

export function CompanyTemplatesListPage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null
  const { effectiveId, isAccountant, blockedNoCompany } = useEffectiveCompanyIdForTemplates()

  const canEditTemplates = useMemo(
    () => buildGrantedCodeSetFromSession(navigation).has('NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT'),
    [navigation]
  )
  const canCreateTemplates = useMemo(
    () => buildGrantedCodeSetFromSession(navigation).has('NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE'),
    [navigation]
  )

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
      if (!effectiveId) {
        setLoading(true)
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchCompanyTemplatesList({ accessToken, q, companyId: effectiveId })
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
  }, [accessToken, q, effectiveId, blockedNoCompany])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="company-templates-search"
          placeholder="Buscar por nombre, código o descripción..."
          ariaLabel="Buscar plantillas por empresa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={isAccountant && !effectiveId}
        />
        {canCreateTemplates ? (
          <button type="button" className="clause-button" onClick={() => navigate('nueva')} disabled={!effectiveId}>
            Nuevo template
          </button>
        ) : null}
      </>
    ),
    [canCreateTemplates, effectiveId, isAccountant, navigate, q]
  )

  if (blockedNoCompany) {
    return (
      <PageShell title={PAGE_TITLE} className="clause-universal-list-page">
        <div className="clause-list-card">
          <div className="clause-error">Usted no tiene una empresa asignada</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={PAGE_TITLE}
      subtitle="Plantillas aplicables a la empresa seleccionada."
      actions={listToolbar}
      className="clause-universal-list-page"
    >
      <div className="clause-list-card">
        {!effectiveId && isAccountant ? (
          <div className="clause-error">Seleccione una empresa en el subencabezado para ver sus plantillas.</div>
        ) : null}
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
                {!effectiveId ? (
                  <tr>
                    <td colSpan={7} className="clause-list-empty">
                      —
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="clause-list-empty">
                      {q.trim()
                        ? 'No hay plantillas que coincidan con la búsqueda.'
                        : 'No hay plantillas por empresa registradas para esta empresa.'}
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((row) => (
                    <tr key={row.id}>
                      <td>{row.code ?? '—'}</td>
                      <td>{row.name ?? '—'}</td>
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
