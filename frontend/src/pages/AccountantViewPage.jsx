import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchAccountantPlatformDetail } from '../api/accountantsPlatformApi'
import { ACCOUNTANTS_LIST_PATH } from '../navigation/platformPaths'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { formatRut } from '../utils/rut'
import './ClauseForm.css'

export function AccountantViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canEdit = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !accessToken) return
      setLoading(true)
      setError(null)
      const res = await fetchAccountantPlatformDetail(id, { accessToken })
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

  const a = data?.accountant
  const companies = Array.isArray(data?.companies) ? data.companies : []
  const rutDisplay = a ? formatRut(a.rut_body, a.rut_dv) : '—'

  const breadcrumb = useMemo(
    () => [
      { label: 'Contadores', to: ACCOUNTANTS_LIST_PATH },
      { label: 'Ver' }
    ],
    []
  )

  const subActions = useMemo(
    () =>
      a && canEdit ? (
        <button type="button" className="clause-button" onClick={() => navigate(`/app/admin-global/contadores/${id}/edit`)}>
          Editar
        </button>
      ) : null,
    [canEdit, navigate, id, a]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader className="clause-universal-view-page">
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          {loading ? (
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : a ? (
            <>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Correo</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={a.email ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Nombre completo</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={a.full_name ?? ''} />
                </div>
              </div>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Teléfono</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={a.phone ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">RUT</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={rutDisplay === '—' ? '' : rutDisplay} />
                </div>
              </div>
              <div className="clause-form-row">
                <div className="clause-label">Dirección</div>
                <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={a.address ?? ''} />
              </div>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Comuna</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={a.commune ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Ciudad</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={a.city ?? ''} />
                </div>
              </div>
              <div className="clause-field clause-field--estado-inline" role="group" aria-label="Estado del contador">
                <span className="clause-label clause-label--estado">Estado</span>
                <label className="clause-estado-activo clause-estado-activo--readonly">
                  <input type="checkbox" checked={a.is_active !== false} disabled tabIndex={-1} />
                  <span>Activo</span>
                </label>
              </div>
              <div className="clause-field">
                <span>Empresas asignadas</span>
                <div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid #E3E6E8', padding: '8px' }}>
                  {companies.length === 0 ? (
                    <span className="clause-muted">Ninguna empresa asignada.</span>
                  ) : (
                    companies.map((c) => (
                      <label
                        key={c.id}
                        className="clause-company-assign-row--readonly"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}
                      >
                        <input type="checkbox" checked tabIndex={-1} disabled />
                        <span>{c.business_name ?? c.id}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
