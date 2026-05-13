import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ListSearchField } from '../components/ListSearchField'
import { fetchInternalCompanyUsersList } from '../api/internalCompanyUsersApi'
import { selectEnrichedCompany, selectEnrichedNavigation, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import './ClauseForm.css'

function formatEstado(isActive) {
  return isActive === false ? 'Inactivo' : 'Activo'
}

export function CompanyInternalUsersListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canCreate = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE')

  const companyId = useMemo(() => {
    const qCo = searchParams.get('companyId')
    if (profile?.code === 'CONTADOR') return selectedCompanyId
    if (profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR') return enrichedCompany?.id ?? null
    if (profile?.code === 'ADMINISTRADOR_PLATAFORMA') return qCo || null
    return null
  }, [profile?.code, selectedCompanyId, enrichedCompany?.id, searchParams])

  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!accessToken || !companyId) {
        setLoading(false)
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchInternalCompanyUsersList({ companyId, q, accessToken })
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
  }, [q, accessToken, companyId])

  const blockedNoCompany = profile?.code === 'CONTADOR' && !selectedCompanyId

  const listToolbar = useMemo(
    () => (
      <>
        <ListSearchField
          id="internal-users-search"
          placeholder="Buscar por correo, nombre o teléfono…"
          ariaLabel="Buscar usuarios internos"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!companyId || blockedNoCompany}
        />
        {canCreate && companyId ? (
          <button
            type="button"
            className="clause-button"
            onClick={() =>
              profile?.code === 'ADMINISTRADOR_PLATAFORMA'
                ? navigate(`/app/admin-global/usuarios-internos-empresa/nuevo?companyId=${encodeURIComponent(companyId)}`)
                : navigate('/app/admin-global/usuarios-internos-empresa/nuevo')
            }
          >
            Nuevo usuario
          </button>
        ) : null}
      </>
    ),
    [blockedNoCompany, canCreate, companyId, navigate, profile?.code, q]
  )

  return (
    <PageShell
      title="Usuarios internos por empresa"
      subtitle="Listado de usuarios de la empresa vinculados como usuarios internos (incluye, por ejemplo, administradores de empresa)."
      actions={listToolbar}
      className="clause-universal-list-page"
    >
      <div className="clause-list-card">
        {blockedNoCompany ? (
          <div className="clause-error">Seleccione una empresa en la barra superior para ver sus usuarios internos.</div>
        ) : null}
        {!companyId && !blockedNoCompany ? (
          <div className="clause-error">No se pudo determinar la empresa. Use el parámetro companyId en la URL si es administrador de plataforma.</div>
        ) : null}

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
                  <th>Teléfono</th>
                  <th>Perfil</th>
                  <th>Estado</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="clause-list-empty">
                      {q.trim() ? 'No hay usuarios que coincidan con la búsqueda.' : 'No hay usuarios internos para esta empresa.'}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.full_name ?? '—'}</td>
                      <td>{row.email ?? '—'}</td>
                      <td>{row.phone ?? '—'}</td>
                      <td>{row.profile_label ?? row.profile_code ?? '—'}</td>
                      <td>{formatEstado(row.is_active)}</td>
                      <td className="clause-list-col-actions">
                        <button
                          type="button"
                          className="clause-link-button"
                          onClick={() =>
                            navigate(`/app/admin-global/usuarios-internos-empresa/${row.id}?companyId=${encodeURIComponent(companyId)}`)
                          }
                        >
                          Ver
                        </button>
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
