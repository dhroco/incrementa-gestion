import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchCompaniesList } from '../api/companiesApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import './ClauseForm.css'

function formatRut(body, dv) {
  if (!body) return '—'
  const d = dv ? String(dv).toUpperCase() : ''
  return d ? `${body}-${d}` : String(body)
}

export function CompaniesListPage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canCreate = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_CREATE')
  const canEdit = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT')

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
      const res = await fetchCompaniesList({ q, accessToken })
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
          id="companies-search"
          placeholder="Buscar por razón social o RUT..."
          ariaLabel="Buscar empresas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canCreate ? (
          <button type="button" className="clause-button" onClick={() => navigate('nueva')}>
            Nueva empresa
          </button>
        ) : null}
      </>
    ),
    [canCreate, navigate, q]
  )

  return (
    <PageShell title="Listado de empresas definidas en el sistema" actions={listToolbar} className="clause-universal-list-page">
      <div className="clause-list-card">
        {error ? <div className="clause-error">{error}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <div className="clause-list-table-wrap">
            <table className="clause-list-table">
              <thead>
                <tr>
                  <th>Razón social</th>
                  <th>RUT</th>
                  <th>Comuna</th>
                  <th>Contador(es) asignado(s)</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="clause-list-empty">
                      No hay empresas registradas.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.business_name ?? '—'}</td>
                      <td>{formatRut(row.rut_body, row.rut_dv)}</td>
                      <td>{row.commune ?? '—'}</td>
                      <td>{row.accountants && String(row.accountants).trim().length > 0 ? row.accountants : '—'}</td>
                      <td className="clause-list-col-actions">
                        <button type="button" className="clause-link-button" onClick={() => navigate(`${row.id}`)}>
                          Ver
                        </button>
                        {canEdit ? (
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

