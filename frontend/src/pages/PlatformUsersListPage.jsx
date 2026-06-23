import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchPlatformUsersList } from '../api/platformUsersPlatformApi'
import { AbilityContext } from '../lib/ability'
import '../styles/shared-form.css'

function formatEstado(isActive) {
  return isActive === false ? 'Inactivo' : 'Activo'
}

export function PlatformUsersListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const createdMessage =
    typeof location.state?.createdMessage === 'string' ? location.state.createdMessage : null
  const ability = useAbility(AbilityContext)

  const canCreate = ability.can('create', 'PlatformUser')
  const canRead = ability.can('read', 'PlatformUser')
  const canEdit = ability.can('update', 'PlatformUser')

  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      setLoading(true)
      setError(null)
      const res = await fetchPlatformUsersList({ q })
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
  }, [q])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="platform-users-search"
          placeholder="Buscar por correo o nombre…"
          ariaLabel="Buscar usuarios"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canCreate ? (
          <button type="button" className="btn" onClick={() => navigate('nuevo')}>
            Nuevo usuario
          </button>
        ) : null}
      </>
    ),
    [canCreate, navigate, q]
  )

  return (
    <PageShell
      title="Listado de usuarios definidos en el sistema"
      actions={listToolbar}
      className="clause-universal-list-page clause-platform-users-list"
    >
      <div className="clause-list-card">
        {createdMessage ? <div className="clause-success">{createdMessage}</div> : null}
        {error ? <div className="clause-error">{error}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <div className="clause-list-table-wrap">
            <table className="clause-list-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Empresa</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="clause-list-empty">
                      {q.trim() ? 'No hay usuarios que coincidan con la búsqueda.' : 'No hay usuarios registrados.'}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.full_name ?? '—'}</td>
                      <td>{row.email ?? '—'}</td>
                      <td>{row.profile_label ?? row.profile_code ?? '—'}</td>
                      <td>{formatEstado(row.is_active)}</td>
                      <td>{row.company?.business_name ?? '—'}</td>
                      <td className="clause-list-col-actions">
                        <span className="clause-list-actions-group">
                          {canRead ? (
                            <button type="button" className="clause-link-button" onClick={() => navigate(`${row.id}`)}>
                              Ver
                            </button>
                          ) : null}
                          {canEdit ? (
                            <button
                              type="button"
                              className="clause-link-button"
                              onClick={() => navigate(`${row.id}/edit`)}
                            >
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
