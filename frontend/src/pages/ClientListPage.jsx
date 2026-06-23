import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchClientsList } from '../api/clientsApi'
import { AbilityContext } from '../lib/ability'
import '../styles/shared-form.css'

const LIST_PATH = '/app/admin-global/clientes'

export function ClientListPage() {
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)

  const canCreate = ability.can('create', 'Client')
  const canRead = ability.can('read', 'Client')
  const canEdit = ability.can('update', 'Client') || ability.can('create', 'Client')

  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!canRead) {
        setLoading(false)
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchClientsList({ search })
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
  }, [search, canRead])

  const breadcrumb = useMemo(() => (canRead ? [{ label: 'Clientes' }] : null), [canRead])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="clients-search"
          placeholder="Buscar por nombre o marca…"
          ariaLabel="Buscar clientes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canCreate ? (
          <button type="button" className="btn" onClick={() => navigate(`${LIST_PATH}/nuevo`)}>
            Nuevo cliente
          </button>
        ) : null}
      </>
    ),
    [canCreate, navigate, search]
  )

  if (!canRead) {
    return (
      <PageShell title="Clientes" className="clause-universal-list-page" breadcrumb={breadcrumb} actions={listToolbar}>
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para ver el listado de clientes.</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Listado de clientes"
      className="clause-universal-list-page"
      breadcrumb={breadcrumb}
      actions={listToolbar}
    >
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
                  <th>Marca</th>
                  <th>Cuenta marca</th>
                  <th>N° productos/campañas</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="clause-list-empty">
                      No hay clientes que coincidan.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name || '—'}</td>
                      <td>{row.brand || '—'}</td>
                      <td>{row.brand_account || '—'}</td>
                      <td>{row.product_campaign_count ?? 0}</td>
                      <td className="clause-list-col-actions">
                        <span className="clause-list-actions-group">
                          <button
                            type="button"
                            className="clause-link-button"
                            onClick={() => navigate(`${LIST_PATH}/${row.id}`)}
                          >
                            Ver
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className="clause-link-button"
                              onClick={() => navigate(`${LIST_PATH}/${row.id}/edit`)}
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
