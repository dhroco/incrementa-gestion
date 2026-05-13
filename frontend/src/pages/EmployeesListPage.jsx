import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchEmployeesList } from '../api/employeesApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { canMutateTrabajadores } from '../navigation/trabajadoresAuth'
import { useEmployeeCompanyScope } from './useEmployeeCompanyScope'
import './ClauseForm.css'

function formatEstado(isActive) {
  return isActive === false ? 'Inactivo' : 'Activo'
}

export function EmployeesListPage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null
  const { companyId, blocked, message: scopeMessage } = useEmployeeCompanyScope()

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canCreate = grantedCodes.has('NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE')
  const canRead = grantedCodes.has('NAV_ACTION_TRABAJADORES_TRABAJADORES_READ')
  const canEdit = canMutateTrabajadores(grantedCodes)

  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!accessToken || !companyId || !canRead) {
        setLoading(false)
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchEmployeesList({ companyId, q, accessToken })
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
  }, [q, accessToken, companyId, canRead])

  const breadcrumb = useMemo(
    () => (canRead ? [{ label: 'Trabajadores' }] : null),
    [canRead]
  )

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="employees-search"
          placeholder="Buscar por nombre, correo, RUT, cargo o jornada…"
          ariaLabel="Buscar trabajadores"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!companyId || blocked}
        />
        {canCreate && companyId && !blocked ? (
          <button type="button" className="clause-button" onClick={() => navigate('nuevo')}>
            Nuevo trabajador
          </button>
        ) : null}
      </>
    ),
    [blocked, canCreate, companyId, navigate, q]
  )

  if (!canRead) {
    return (
      <PageShell title="Trabajadores" className="clause-universal-list-page" breadcrumb={breadcrumb} actions={listToolbar}>
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para ver el listado de trabajadores.</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Listado de trabajadores"
      className="clause-universal-list-page"
      breadcrumb={breadcrumb}
      actions={listToolbar}
    >
      <div className="clause-list-card">
        {blocked && scopeMessage ? <div className="clause-error">{scopeMessage}</div> : null}
        {!companyId && !blocked ? <div className="clause-error">No se pudo determinar la empresa.</div> : null}

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
                  <th>Cargo</th>
                  <th>Jornada</th>
                  <th>Estado</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="clause-list-empty">
                      No hay trabajadores que coincidan.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.full_name || '—'}</td>
                      <td>{row.rut || '—'}</td>
                      <td>{row.email && String(row.email).trim() ? row.email : '—'}</td>
                      <td>{row.position_name || '—'}</td>
                      <td>{row.work_schedule_name || '—'}</td>
                      <td>{formatEstado(row.is_active)}</td>
                      <td className="clause-list-col-actions">
                        <span className="clause-list-actions-group">
                          <button
                            type="button"
                            className="clause-link-button"
                            onClick={() => navigate(`/app/trabajadores/${row.id}`)}
                          >
                            Ver
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className="clause-link-button"
                              onClick={() => navigate(`/app/trabajadores/${row.id}/edit`)}
                            >
                              Editar
                            </button>
                          ) : null}
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
