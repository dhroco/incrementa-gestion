import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { PageShell } from '../components/PageShell'
import { fetchClauseDetail, updateClause } from '../api/clausesApi'
import { CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES } from '../constants/clauseMessages'
import { selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectAssignedCompanies } from '../store/sessionCompanySlice'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ClauseTemplateMetadataPanel } from '../components/ClauseTemplateMetadataPanel'
import { validateClauseContentJsonClient } from '../utils/clauseContentJson'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function ClauseEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const profile = useSelector(selectEnrichedProfile)
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const isAccountant = profile?.code === 'CONTADOR'
  const blockedCompanyClause =
    pathname.includes('clausulas-por-empresa') && isAccountant && assignedCompanies.length === 0

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [entity, setEntity] = useState(null)

  const [titleClause, setTitleClause] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [contentJson, setContentJson] = useState(null)
  const [status, setStatus] = useState('draft')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmState, setConfirmState] = useState({ nextStatus: null, title: '', message: '', destructive: false })

  const canSubmit = useMemo(
    () => isNonEmptyString(titleClause) && isNonEmptyString(code) && !!accessToken && !!entity,
    [titleClause, code, accessToken, entity]
  )

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !accessToken) return
      setLoading(true)
      setError(null)
      const res = await fetchClauseDetail(id, { accessToken })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setEntity(res.data)
      setTitleClause(res.data?.title_clause ?? '')
      setCode(res.data?.code ?? '')
      setDescription(res.data?.description ?? '')
      setContentJson(res.data?.content_json ?? null)
      setStatus(res.data?.status ?? 'draft')
    }
    run()
    return () => {
      active = false
    }
  }, [id, accessToken])

  async function doSave(nextStatus) {
    if (!id || !canSubmit) return

    const contentCheck = validateClauseContentJsonClient(contentJson)
    if (!contentCheck.ok) {
      setError(contentCheck.message)
      setSuccess(null)
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    const res = await updateClause(
      id,
      {
        title_clause: titleClause,
        code,
        description: description.trim().length ? description : null,
        content_json: contentJson,
        status: nextStatus
      },
      { accessToken }
    )
    setSubmitting(false)
    if (!res.ok) {
      if (res.code === 'CLAUSE_IN_USE_BY_ACTIVE_TEMPLATE') {
        setError('No se puede inactivar porque la cláusula está en uso en una plantilla activa.')
      } else if (res.code === 'INVALID_STATUS_TRANSITION') {
        setError('Transición de estado no permitida.')
      } else if (res.code === 'CLAUSE_INVALID_STATUS') {
        setError('Estado inválido. Use Borrador, Activa o Inactiva.')
      } else if (res.code === 'CLAUSE_CODE_NOT_UNIQUE' && pathname.includes('clausulas-por-empresa')) {
        setError(res.message || CLAUSE_CODE_NOT_UNIQUE_COMPANY_FALLBACK_ES)
      } else {
        setError(res.message)
      }
      return
    }
    setEntity(res.data)
    setStatus(res.data?.status ?? nextStatus)
    setSuccess('Cambios guardados correctamente.')
    window.setTimeout(() => {
      navigate(listPath)
    }, 800)
  }

  function onSave() {
    if (!id || !canSubmit) return

    const nextStatus = typeof status === 'string' ? status : 'draft'
    const currentStatus = entity?.status ?? 'draft'
    const isChanging = nextStatus !== currentStatus
    const needsConfirm = isChanging && (nextStatus === 'active' || nextStatus === 'inactive')

    if (!needsConfirm) {
      void doSave(nextStatus)
      return
    }

    const label = mapClauseStatusToSpanish(nextStatus)
    setConfirmState({
      nextStatus,
      title: 'Confirmar cambio de estado',
      message: `¿Confirmas cambiar el estado a “${label}”?`,
      destructive: nextStatus === 'inactive'
    })
    setConfirmOpen(true)
  }

  const listPath = pathname.includes('clausulas-por-empresa')
    ? '/app/gestion-contratos/clausulas-por-empresa'
    : '/app/gestion-contratos/clausulas-universales'

  const sectionLabel = pathname.includes('clausulas-por-empresa') ? 'Cláusulas por empresa' : 'Cláusulas universales'

  const breadcrumb = useMemo(
    () => [
      { label: sectionLabel, to: listPath },
      { label: 'Editar' }
    ],
    [listPath, sectionLabel]
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="clause-button" onClick={onSave} disabled={!canSubmit || submitting}>
        {submitting ? 'Guardando…' : 'Guardar cambios'}
      </button>
    ),
    [canSubmit, onSave, submitting]
  )

  if (blockedCompanyClause) {
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
      <ConfirmDialog
        open={confirmOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="Confirmar"
        cancelText="Cancelar"
        destructive={confirmState.destructive}
        onCancel={() => {
          setConfirmOpen(false)
          setConfirmState({ nextStatus: null, title: '', message: '', destructive: false })
        }}
        onConfirm={() => {
          const next = confirmState.nextStatus ?? (typeof status === 'string' ? status : 'draft')
          setConfirmOpen(false)
          setConfirmState({ nextStatus: null, title: '', message: '', destructive: false })
          void doSave(next)
        }}
      />
      <div className="ph-card clause-card">
        <div className="clause-form">
          {success ? <div className="clause-success">{success}</div> : null}
          {error ? <div className="clause-error">{error}</div> : null}
          {loading ? (
            <div className="clause-list-loading">Cargando…</div>
          ) : (
            <>
              <ClauseTemplateMetadataPanel
                defaultExpanded={false}
                code={code}
                primaryLabel={titleClause}
                entityKind="clause"
              >
                <div className="clause-form-row clause-form-row--audit-three">
                  <div className="clause-form-col">
                    <div className="clause-label">Autor</div>
                    <input
                      readOnly
                      tabIndex={-1}
                      className="clause-input clause-input--readonly"
                      value={auditPersonLabel(entity?.created_by_name, entity?.created_by)}
                    />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Último editor</div>
                    <input
                      readOnly
                      tabIndex={-1}
                      className="clause-input clause-input--readonly"
                      value={auditPersonLabel(entity?.last_edited_by_name, entity?.last_edited_by)}
                    />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Fecha último cambio</div>
                    <input
                      readOnly
                      tabIndex={-1}
                      className="clause-input clause-input--readonly"
                      value={formatAuditDateTime(entity?.updated_at)}
                    />
                  </div>
                </div>

                <div className="clause-form-row clause-form-row--three-col">
                  <div className="clause-form-col">
                    <div className="clause-label">Título</div>
                    <input
                      className="clause-input"
                      value={titleClause}
                      onChange={(e) => setTitleClause(e.target.value)}
                    />
                  </div>

                  <div className="clause-form-col">
                    <div className="clause-label">Código</div>
                    <input className="clause-input" value={code} onChange={(e) => setCode(e.target.value)} />
                  </div>

                  <div className="clause-form-col">
                    <div className="clause-label">Estado</div>
                    <select className="clause-input" value={status ?? 'draft'} onChange={(e) => setStatus(e.target.value)}>
                      <option value="draft">Borrador</option>
                      <option value="active">Activa</option>
                      <option value="inactive">Inactiva</option>
                    </select>
                  </div>
                </div>

                <div className="clause-form-row">
                  <div className="clause-label">Descripción</div>
                  <textarea
                    className="clause-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
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
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}

