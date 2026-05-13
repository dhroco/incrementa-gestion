import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchAccountantsPlatformList } from '../api/accountantsPlatformApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import './ClauseForm.css'

function formatRut(body, dv) {
  if (!body) return '—'
  const d = dv ? String(dv).toUpperCase() : ''
  return d ? `${body}-${d}` : String(body)
}

function formatEstado(isActive) {
  return isActive === false ? 'Inactivo' : 'Activo'
}

function formatCompaniesList(companies) {
  if (!Array.isArray(companies) || companies.length === 0) return '—'
  const names = companies.map((c) => c?.business_name).filter((n) => typeof n === 'string' && n.trim().length > 0)
  return names.length ? names.join(', ') : '—'
}

export function AccountantsListPage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canCreate = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE')
  const canRead = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ')
  const canEdit = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT')

  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!accessToken) {
        setLoading(false)
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchAccountantsPlatformList({ q, accessToken })
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
  }, [q, accessToken])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="accountants-search"
          placeholder="Buscar por correo, nombre, RUT, comuna o ciudad..."
          ariaLabel="Buscar contadores"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canCreate ? (
          <button type="button" className="clause-button" onClick={() => navigate('nuevo')}>
            Nuevo contador
          </button>
        ) : null}
      </>
    ),
    [canCreate, navigate, q]
  )

  return (
    <PageShell title="Listado de contadores definidos en el sistema" actions={listToolbar} className="clause-universal-list-page">
      <div className="clause-list-card">
        {error ? <div className="clause-error">{error}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <div className="clause-list-table-wrap">
            <table className="clause-list-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Empresas</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="clause-list-empty">
                      {q.trim()
                        ? 'No hay contadores que coincidan con la búsqueda.'
                        : 'No hay contadores registrados.'}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.full_name ?? '—'}</td>
                      <td>{formatRut(row.rut_body, row.rut_dv)}</td>
                      <td>{row.email ?? '—'}</td>
                      <td>{row.phone && String(row.phone).trim() ? row.phone : '—'}</td>
                      <td>{formatEstado(row.is_active)}</td>
                      <td className="accountant-list-cell-companies" title={formatCompaniesList(row.companies)}>
                        {formatCompaniesList(row.companies)}
                      </td>
                      <td className="clause-list-col-actions">
                        <span className="clause-list-actions-group">
                          {canRead ? (
                            <button type="button" className="clause-link-button" onClick={() => navigate(`${row.id}`)}>
                              Ver
                            </button>
                          ) : null}
                          {canEdit ? (
                            <button type="button" className="clause-link-button" onClick={() => navigate(`${row.id}/edit`)}>
                              Editar
                            </button>
                          ) : null}
                          {!canRead && !canEdit ? '—' : null}
                        </span>
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
