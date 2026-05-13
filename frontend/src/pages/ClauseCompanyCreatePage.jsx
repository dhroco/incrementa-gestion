import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { PageShell } from '../components/PageShell'
import { ClauseTemplateMetadataPanel } from '../components/ClauseTemplateMetadataPanel'
import { createCompanyClause } from '../api/clausesApi'
import { CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES } from '../constants/clauseMessages'
import { selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectAssignedCompanies, selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { validateClauseContentJsonClient } from '../utils/clauseContentJson'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function ClauseCompanyCreatePage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const profile = useSelector(selectEnrichedProfile)
  const defaultAuthorLabel = auditPersonLabel(profile?.label, null)
  const defaultUpdatedAtLabel = formatAuditDateTime(new Date())
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  const isAccountant = profile?.code === 'CONTADOR'
  const blockedNoCompany = isAccountant && assignedCompanies.length === 0

  const [titleClause, setTitleClause] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [contentJson, setContentJson] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const canSubmit = useMemo(() => {
    if (!isNonEmptyString(titleClause) || !isNonEmptyString(code) || !accessToken) return false
    if (isAccountant && !selectedCompanyId) return false
    return true
  }, [titleClause, code, accessToken, isAccountant, selectedCompanyId])

  async function onSubmit() {
    if (!canSubmit) return
    const contentCheck = validateClauseContentJsonClient(contentJson)
    if (!contentCheck.ok) {
      setError(contentCheck.message)
      setSuccess(null)
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    const res = await createCompanyClause(
      {
        title_clause: titleClause,
        code,
        description: description.trim().length ? description : null,
        content_json: contentJson
      },
      { accessToken, companyId: isAccountant ? selectedCompanyId : undefined }
    )
    setSubmitting(false)
    if (!res.ok) {
      if (res.code === 'CLAUSE_CODE_NOT_UNIQUE') {
        setError(res.message || CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES)
      } else {
        setError(res.message ?? 'No se pudo guardar la cláusula.')
      }
      return
    }
    setSuccess('La cláusula se creó correctamente.')
    window.setTimeout(() => {
      navigate(listPath)
    }, 900)
  }

  const listPath = '/app/gestion-contratos/clausulas-por-empresa'

  const breadcrumb = useMemo(
    () => [
      { label: 'Cláusulas por empresa', to: listPath },
      { label: 'Nueva cláusula' }
    ],
    [listPath]
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="clause-button" onClick={onSubmit} disabled={!canSubmit || submitting}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [canSubmit, onSubmit, submitting]
  )

  if (blockedNoCompany) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="ph-card clause-card">
          <div className="clause-error">Usted no tiene una empresa asignada</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {success ? <div className="clause-success">{success}</div> : null}
          {error ? <div className="clause-error">{error}</div> : null}

          <ClauseTemplateMetadataPanel
            defaultExpanded
            code={code}
            primaryLabel={titleClause}
            entityKind="clause"
          >
            <div className="clause-form-row clause-form-row--audit-four">
              <div className="clause-form-col">
                <div className="clause-label">Autor</div>
                <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={defaultAuthorLabel} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Último editor</div>
                <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={defaultAuthorLabel} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Fecha último cambio</div>
                <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={defaultUpdatedAtLabel} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Estado</div>
                <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={mapClauseStatusToSpanish('draft')} />
              </div>
            </div>

            <div className="clause-form-row clause-form-row--two-col">
              <div className="clause-form-col">
                <div className="clause-label">Título</div>
                <input
                  className="clause-input"
                  value={titleClause}
                  onChange={(e) => setTitleClause(e.target.value)}
                  placeholder="Ingrese el título de la cláusula"
                />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Código</div>
                <input
                  className="clause-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: CLAUSULA-A001"
                />
              </div>
            </div>

            <div className="clause-form-row">
              <div className="clause-label">Descripción</div>
              <textarea
                className="clause-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Descripción resumida"
              />
            </div>
          </ClauseTemplateMetadataPanel>

          <div className="clause-form-row clause-form-row--editor">
            <div className="clause-label">Contenido</div>
            <RichTextEditor
              variant="document"
              content={contentJson ?? ''}
              onChange={(json) => setContentJson(json)}
            />
          </div>
        </div>
      </div>
    </PageShell>
  )
}

