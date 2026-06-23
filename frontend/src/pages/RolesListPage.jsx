import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchRolesList } from '../api/rolesApi'
import { AbilityContext } from '../lib/ability'
import '../styles/shared-form.css'

export function RolesListPage() {
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)

  const canCreate = ability.can('create', 'RolePermission')
  const canRead = ability.can('read', 'RolePermission')
  const canEdit = ability.can('update', 'RolePermission')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      setLoading(true)
      setError(null)
      const res = await fetchRolesList({})
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
    () =>
      canCreate ? (
        <button type="button" className="btn" onClick={() => navigate('nuevo')}>
          Nuevo rol
        </button>
      ) : null,
    [canCreate, navigate]
  )

  return (
    <PageShell title="Roles y permisos" actions={listToolbar} className="clause-universal-list-page">
      <div className="clause-list-card">
        {error ? <div className="clause-error">{error}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <div className="clause-list-table-wrap">
            <table className="clause-list-table">
              <thead>
                <tr>
                  <th>Nombre del rol</th>
                  <th>Código</th>
                  <th>Tipo de acceso</th>
                  <th>Usuarios asignados</th>
                  <th>Permisos</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="clause-list-empty">
                      No hay roles registrados.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label ?? '—'}</td>
                      <td>{row.code ?? '—'}</td>
                      <td>{row.hasFullAccess ? 'Acceso total' : 'Acceso limitado'}</td>
                      <td>{row.usersCount ?? 0}</td>
                      <td>{row.permissionsCount ?? 0}</td>
                      <td className="clause-list-col-actions">
                        <span className="clause-list-actions-group">
                          {canRead ? (
                            <button
                              type="button"
                              className="clause-link-button"
                              onClick={() => navigate(`${row.id}`)}
                            >
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
