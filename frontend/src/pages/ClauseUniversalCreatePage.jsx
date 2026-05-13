import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { PageShell } from '../components/PageShell'
import { ClauseTemplateMetadataPanel } from '../components/ClauseTemplateMetadataPanel'
import { createUniversalClause } from '../api/clausesApi'
import { selectEnrichedProfile, selectSession } from '../store/authSlice'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import { validateClauseContentJsonClient } from '../utils/clauseContentJson'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function ClauseUniversalCreatePage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const profile = useSelector(selectEnrichedProfile)
  const accessToken = session?.access_token ?? null
  const defaultAuthorLabel = auditPersonLabel(profile?.label, null)
  const defaultUpdatedAtLabel = formatAuditDateTime(new Date())

  const [titleClause, setTitleClause] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [contentJson, setContentJson] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const canSubmit = useMemo(() => isNonEmptyString(titleClause) && isNonEmptyString(code) && !!accessToken, [
    titleClause,
    code,
    accessToken
  ])

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
    const res = await createUniversalClause(
      {
        title_clause: titleClause,
        code,
        description: description.trim().length ? description : null,
        content_json: contentJson
      },
      { accessToken }
    )
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo guardar la cláusula.')
      return
    }
    setSuccess('La cláusula se creó correctamente.')
    window.setTimeout(() => {
      navigate(listPath)
    }, 900)
  }

  const listPath = '/app/gestion-contratos/clausulas-universales'

  const breadcrumb = useMemo(
    () => [
      { label: 'Cláusulas universales', to: listPath },
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
            <div className="clause-form-row clause-form-row--audit-three">
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
            </div>

            <div className="clause-form-row clause-form-row--three-col">
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
              <div className="clause-form-col">
                <div className="clause-label">Estado</div>
                <input
                  readOnly
                  tabIndex={-1}
                  className="clause-input clause-input--readonly"
                  value={mapClauseStatusToSpanish('draft')}
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

