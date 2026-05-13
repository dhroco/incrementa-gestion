import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchPlatformUserDetail } from '../api/platformUsersPlatformApi'
import { PLATFORM_USERS_LIST_PATH } from '../navigation/platformPaths'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { formatRut } from '../utils/rut'
import './ClauseForm.css'

export function PlatformUserViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canEdit = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_EDIT')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !accessToken) return
      setLoading(true)
      setError(null)
      const res = await fetchPlatformUserDetail(id, { accessToken })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message)
        setData(null)
        return
      }
      setData(res.data)
    }
    run()
    return () => {
      active = false
    }
  }, [id, accessToken])

  const u = data?.user
  const co = data?.company
  const rutDisplay = u ? formatRut(u.rut_body, u.rut_dv) : '—'

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios plataforma', to: PLATFORM_USERS_LIST_PATH },
      { label: 'Ver' }
    ],
    []
  )

  const subActions = useMemo(
    () =>
      u && canEdit ? (
        <button type="button" className="clause-button" onClick={() => navigate(`/app/admin-global/usuarios-plataforma/${id}/edit`)}>
          Editar
        </button>
      ) : null,
    [canEdit, navigate, id, u]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader className="clause-universal-view-page">
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          {loading ? (
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : u ? (
            <>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Correo</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={u.email ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Nombre completo</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={u.full_name ?? ''} />
                </div>
              </div>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Teléfono</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={u.phone ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">RUT</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={rutDisplay === '—' ? '' : rutDisplay} />
                </div>
              </div>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Perfil</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={u.profile_label ?? u.profile_code ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-field clause-field--estado-inline" role="group" aria-label="Estado del usuario">
                    <span className="clause-label clause-label--estado">Estado</span>
                    <label className="clause-estado-activo clause-estado-activo--readonly">
                      <input type="checkbox" checked={u.is_active !== false} disabled tabIndex={-1} />
                      <span>Activo</span>
                    </label>
                  </div>
                </div>
              </div>
              {co?.id ? (
                <div className="clause-form-row">
                  <div className="clause-label">Empresa</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={co.business_name ?? co.id} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
