import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { FormSection } from '../components/CompanyFormSections'
import { RutInput } from '../components/RutInput'
import { updateCompany } from '../api/companiesApi'
import {
  buildCompanyMutationPayload,
  isValidEmailField,
  validateHeadquartersForCompanySubmit
} from '../utils/companyFormPayload'
import {
  isCompanyRutConflictResponse,
  isCompanyRutDuplicateUserMessage,
  userMessageFromCompanySaveFailure
} from '../utils/companyApiErrors'
import { parseOptionalRut, parseRut } from '../utils/rut'
import '../styles/shared-form.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function CompaniesEditForm() {
  const navigate = useNavigate()
  const ctx = useOutletContext()
  const {
    companyId: id,
    listPath,
    loading,
    error: loadError,
    entity,
    allowedToEdit,
    businessName,
    setBusinessName,
    shortName,
    setShortName,
    rut,
    setRut,
    businessActivity,
    setBusinessActivity,
    address,
    setAddress,
    commune,
    setCommune,
    city,
    setCity,
    region,
    setRegion,
    email,
    setEmail,
    phone,
    setPhone,
    nameLegal1,
    setNameLegal1,
    rutLegal1,
    setRutLegal1,
    nameLegal2,
    setNameLegal2,
    rutLegal2,
    setRutLegal2
  } = ctx

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [rutServerMessage, setRutServerMessage] = useState(null)

  const rutCheck = useMemo(() => parseRut(rut), [rut])
  const emailOk = useMemo(() => isValidEmailField(email), [email])
  const rutLegal1Check = useMemo(() => parseOptionalRut(rutLegal1), [rutLegal1])
  const rutLegal2Check = useMemo(() => parseOptionalRut(rutLegal2), [rutLegal2])

  const canSubmit = useMemo(() => {
    return (
      !!entity &&
      isNonEmptyString(businessName) &&
      isNonEmptyString(shortName) &&
      rutCheck.ok &&
      emailOk &&
      rutLegal1Check.ok &&
      rutLegal2Check.ok
    )
  }, [entity, businessName, shortName, rutCheck.ok, emailOk, rutLegal1Check.ok, rutLegal2Check.ok])

  async function onSave() {
    if (!id || !canSubmit || !allowedToEdit) return
    const hq = validateHeadquartersForCompanySubmit({
      businessName,
      shortName,
      rut,
      email,
      rutLegal1,
      rutLegal2
    })
    if (!hq.ok) {
      setError(hq.message)
      return
    }

    setSubmitting(true)
    setError(null)
    setRutServerMessage(null)
    const res = await updateCompany(
      id,
      buildCompanyMutationPayload({
        businessName,
        shortName,
        rut,
        businessActivity,
        address,
        commune,
        city,
        region,
        email,
        phone,
        nameLegal1,
        rutLegal1,
        nameLegal2,
        rutLegal2
      }),
      {}
    )
    if (!res.ok) {
      setSubmitting(false)
      const msg = userMessageFromCompanySaveFailure(res)
      setError(msg)
      setRutServerMessage(isCompanyRutConflictResponse(res) ? msg : null)
      return
    }

    setSubmitting(false)
    navigate('/app/admin-global/empresas')
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Empresas', to: listPath },
      { label: 'Editar' }
    ],
    [listPath]
  )

  const subActions = (
    <button
      type="button"
      className="btn"
      onClick={onSave}
      disabled={!canSubmit || submitting || !allowedToEdit}
    >
      {submitting ? 'Guardando…' : 'Guardar cambios'}
    </button>
  )

  const displayError = error || loadError

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {displayError ? <div className="clause-error">{displayError}</div> : null}
          {!loading && entity && !allowedToEdit ? (
            <div className="clause-error">No tiene permiso para editar esta empresa.</div>
          ) : null}
          {loading ? (
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : entity && allowedToEdit ? (
            <>
              <div className="clause-form-row clause-form-row--two-col">
                <div className="clause-form-col">
                  <div className="clause-label">Razón Social</div>
                  <input className="clause-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">RUT</div>
                  <RutInput
                    optional={false}
                    value={rut}
                    onChange={(next) => {
                      setRut(next)
                      setRutServerMessage(null)
                      setError((prev) => (prev && isCompanyRutDuplicateUserMessage(prev) ? null : prev))
                    }}
                    aria-invalid={Boolean(rutServerMessage) || (!rutCheck.ok && Boolean(rut.trim()))}
                    aria-describedby={rutServerMessage ? 'company-edit-rut-server-msg' : undefined}
                  />
                  {!rutCheck.ok && rut.trim().length ? (
                    <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>{rutCheck.message}</div>
                  ) : null}
                  {rutServerMessage ? (
                    <div id="company-edit-rut-server-msg" style={{ fontSize: '12px', color: '#000', opacity: 0.9 }} role="alert">
                      {rutServerMessage}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="company-form-level2">
                <div className="clause-form-col">
                  <div className="clause-label">
                    Nombre comercial <span style={{ color: 'red' }}>*</span>
                  </div>
                  <input className="clause-input" value={shortName} onChange={(e) => setShortName(e.target.value)} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Giro</div>
                  <input className="clause-input" value={businessActivity} onChange={(e) => setBusinessActivity(e.target.value)} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Correo</div>
                  <input className="clause-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {!emailOk && email.trim().length ? (
                    <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>Correo inválido.</div>
                  ) : null}
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">Teléfono</div>
                  <input className="clause-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              <FormSection title="Domicilio y Jurisdicción">
                <div className="clause-form-row">
                  <div className="clause-label">Dirección</div>
                  <input className="clause-input" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="clause-form-row clause-form-row--three-equal">
                  <div className="clause-form-col">
                    <div className="clause-label">Comuna</div>
                    <input className="clause-input" value={commune} onChange={(e) => setCommune(e.target.value)} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Ciudad</div>
                    <input className="clause-input" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Región</div>
                    <input className="clause-input" value={region} onChange={(e) => setRegion(e.target.value)} />
                  </div>
                </div>
              </FormSection>

              <div className="company-form-rep-row-with-vrule">
                <div className="company-form-rep-col">
                  <h3 className="clause-form-section-title">Representante legal 1</h3>
                  <div className="clause-form-row clause-form-row--two-equal">
                    <div className="clause-form-col">
                      <div className="clause-label">Nombre</div>
                      <input className="clause-input" value={nameLegal1} onChange={(e) => setNameLegal1(e.target.value)} />
                    </div>
                    <div className="clause-form-col">
                      <div className="clause-label">RUT</div>
                      <RutInput value={rutLegal1} onChange={setRutLegal1} />
                      {!rutLegal1Check.ok && rutLegal1.trim().length ? (
                        <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>{rutLegal1Check.message}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="company-form-rep-vrule" role="separator" aria-orientation="vertical" />
                <div className="company-form-rep-col">
                  <h3 className="clause-form-section-title">Representante legal 2</h3>
                  <div className="clause-form-row clause-form-row--two-equal">
                    <div className="clause-form-col">
                      <div className="clause-label">Nombre</div>
                      <input className="clause-input" value={nameLegal2} onChange={(e) => setNameLegal2(e.target.value)} />
                    </div>
                    <div className="clause-form-col">
                      <div className="clause-label">RUT</div>
                      <RutInput value={rutLegal2} onChange={setRutLegal2} />
                      {!rutLegal2Check.ok && rutLegal2.trim().length ? (
                        <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>{rutLegal2Check.message}</div>
                      ) : null}
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
