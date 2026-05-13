import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchInternalCompanyUserDetail } from '../api/internalCompanyUsersApi'
import { formatRut } from '../utils/rut'
import { selectEnrichedCompany, selectEnrichedNavigation, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import './ClauseForm.css'

export function CompanyInternalUserViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canEdit = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT')

  const companyId = useMemo(() => {
    const qCo = searchParams.get('companyId')
    if (profile?.code === 'CONTADOR') return selectedCompanyId
    if (profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR') return enrichedCompany?.id ?? null
    if (profile?.code === 'ADMINISTRADOR_PLATAFORMA') return qCo || null
    return null
  }, [profile?.code, selectedCompanyId, enrichedCompany?.id, searchParams])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !accessToken) return
      if (!companyId) {
        setLoading(false)
        setError(null)
        setData(null)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchInternalCompanyUserDetail({ id, companyId, accessToken })
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
  }, [id, accessToken, companyId])

  const u = data?.user
  const rutDisplay = u ? formatRut(u.rut_body, u.rut_dv) : '—'

  const listPath = useMemo(() => {
    const base = '/app/admin-global/usuarios-internos-empresa'
    if (profile?.code === 'ADMINISTRADOR_PLATAFORMA' && companyId) {
      return `${base}?companyId=${encodeURIComponent(companyId)}`
    }
    return base
  }, [companyId, profile?.code])

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios internos empresa', to: listPath },
      { label: 'Ver' }
    ],
    [listPath]
  )

  const editPath = useMemo(() => {
    if (!u || !companyId) return null
    return `/app/admin-global/usuarios-internos-empresa/${u.id}/edit?companyId=${encodeURIComponent(companyId)}`
  }, [u, companyId])

  const subActions = useMemo(
    () =>
      u && canEdit && editPath ? (
        <button type="button" className="clause-button" onClick={() => navigate(editPath)}>
          Editar
        </button>
      ) : null,
    [canEdit, navigate, u, editPath]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader className="clause-universal-view-page">
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          {!companyId && profile?.code === 'ADMINISTRADOR_PLATAFORMA' ? (
            <div className="clause-error">Indique companyId en la URL para ver este usuario.</div>
          ) : null}
          {!companyId && profile?.code !== 'ADMINISTRADOR_PLATAFORMA' ? (
            <div className="clause-error">No se pudo determinar la empresa.</div>
          ) : null}
          {loading ? (
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : u && companyId ? (
            <>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Nombre</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={u.full_name ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Correo</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={u.email ?? ''} />
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
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
