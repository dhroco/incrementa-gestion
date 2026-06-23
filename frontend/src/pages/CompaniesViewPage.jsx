import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { FormSection } from '../components/CompanyFormSections'
import { fetchCompanyDetail } from '../api/companiesApi'
import { selectEnrichedCompany, selectEnrichedProfile } from '../store/authSlice'
import { AbilityContext } from '../lib/ability'
import { formatRut } from '../utils/rut'
import '../styles/shared-form.css'

export function CompaniesViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)

  const canEdit = ability.can('update', 'Company')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entity, setEntity] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!id) return
      setLoading(true)
      setError(null)
      const res = await fetchCompanyDetail(id, {})
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message)
        setEntity(null)
        return
      }
      setEntity(res.data)
    }
    run()
    return () => {
      active = false
    }
  }, [id])

  const listPath = '/app/admin-global/empresas'
  const rutDisplay = entity ? formatRut(entity.rut_body, entity.rut_dv) : '—'
  const rutLegal1 = entity ? formatRut(entity.rut_body_legal_representative_1, entity.rut_dv_legal_representative_1) : ''
  const rutLegal2 = entity ? formatRut(entity.rut_body_legal_representative_2, entity.rut_dv_legal_representative_2) : ''

  const breadcrumb = useMemo(
    () => [
      { label: 'Empresas', to: listPath },
      { label: 'Ver' }
    ],
    [listPath]
  )

  const subActions = useMemo(
    () =>
      entity && canEdit ? (
        <button type="button" className="btn" onClick={() => navigate('edit')}>
          Editar
        </button>
      ) : null,
    [canEdit, entity, navigate]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader className="clause-universal-view-page">
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          {loading ? (
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : entity ? (
            <>
              <div className="clause-form-row clause-form-row--two-col">
                <div className="clause-form-col">
                  <div className="clause-label">Razón Social</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.business_name ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">RUT</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={rutDisplay === '—' ? '' : rutDisplay} />
                </div>
              </div>

              <div className="company-form-level2">
                <div className="clause-form-col">
                  <div className="clause-label">Nombre comercial</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.short_name ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Giro</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.business_activity ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Correo</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.email ?? ''} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Teléfono</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.phone ?? ''} />
                </div>
              </div>

              <FormSection title="Domicilio y Jurisdicción">
                <div className="clause-form-row">
                  <div className="clause-label">Dirección</div>
                  <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.address ?? ''} />
                </div>
                <div className="clause-form-row clause-form-row--three-equal">
                  <div className="clause-form-col">
                    <div className="clause-label">Comuna</div>
                    <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.commune ?? ''} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Ciudad</div>
                    <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.city ?? ''} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Región</div>
                    <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={entity.region ?? ''} />
                  </div>
                </div>
              </FormSection>

              <div className="company-form-rep-row-with-vrule">
                <div className="company-form-rep-col">
                  <h3 className="clause-form-section-title">Representante legal 1</h3>
                  <div className="clause-form-row clause-form-row--two-equal">
                    <div className="clause-form-col">
                      <div className="clause-label">Nombre</div>
                      <input
                        className="clause-input clause-input--readonly"
                        readOnly
                        tabIndex={-1}
                        value={entity.name_legal_representative_1 ?? ''}
                      />
                    </div>
                    <div className="clause-form-col">
                      <div className="clause-label">RUT</div>
                      <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={rutLegal1} />
                    </div>
                  </div>
                </div>
                <div className="company-form-rep-vrule" role="separator" aria-orientation="vertical" />
                <div className="company-form-rep-col">
                  <h3 className="clause-form-section-title">Representante legal 2</h3>
                  <div className="clause-form-row clause-form-row--two-equal">
                    <div className="clause-form-col">
                      <div className="clause-label">Nombre</div>
                      <input
                        className="clause-input clause-input--readonly"
                        readOnly
                        tabIndex={-1}
                        value={entity.name_legal_representative_2 ?? ''}
                      />
                    </div>
                    <div className="clause-form-col">
                      <div className="clause-label">RUT</div>
                      <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={rutLegal2} />
                    </div>
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
