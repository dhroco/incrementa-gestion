import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchSuppliersList } from '../api/suppliersApi'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import { AbilityContext } from '../lib/ability'
import { formatRutDisplay } from '../utils/rut'
import '../styles/shared-form.css'

export function SupplierListPage() {
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)

  const canCreate = ability.can('create', 'Supplier')
  const canRead = ability.can('read', 'Supplier')
  const canEdit = ability.can('update', 'Supplier') || ability.can('create', 'Supplier')

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
      const res = await fetchSuppliersList({ search })
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

  const breadcrumb = useMemo(() => (canRead ? [{ label: 'Proveedores' }] : null), [canRead])

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="suppliers-search"
          placeholder="Buscar por nombre, razón social o RUT…"
          ariaLabel="Buscar proveedores"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canCreate ? (
          <button type="button" className="btn" onClick={() => navigate('nuevo')}>
            Nuevo proveedor
          </button>
        ) : null}
      </>
    ),
    [canCreate, navigate, search]
  )

  if (!canRead) {
    return (
      <PageShell title="Proveedores" className="clause-universal-list-page" breadcrumb={breadcrumb} actions={listToolbar}>
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para ver el listado de proveedores.</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Listado de proveedores"
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
                  <th>Tipo</th>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Redes sociales</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="clause-list-empty">
                      No hay proveedores que coincidan.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <SupplierTypeChip supplierType={row.supplier_type} />
                      </td>
                      <td>{row.display_name || '—'}</td>
                      <td>{formatRutDisplay(row.rut)}</td>
                      <td>{row.social_network_count ?? 0}</td>
                      <td className="clause-list-col-actions">
                        <span className="clause-list-actions-group">
                          <button
                            type="button"
                            className="clause-link-button"
                            onClick={() => navigate(`/app/proveedores/${row.id}`)}
                          >
                            Ver
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className="clause-link-button"
                              onClick={() => navigate(`/app/proveedores/${row.id}/edit`)}
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
