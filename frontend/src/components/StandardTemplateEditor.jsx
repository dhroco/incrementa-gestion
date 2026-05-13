import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from './RichTextEditor'
import { PageShell } from './PageShell'
import { ClauseTemplateMetadataPanel } from './ClauseTemplateMetadataPanel'
import { createStandardTemplate, fetchStandardTemplateById, updateStandardTemplate } from '../api/standardTemplatesApi'
import {
  createCompanyTemplate,
  fetchCompanyTemplateById,
  updateCompanyTemplate,
} from '../api/companyTemplatesApi'
import { fetchUniversalClausesList, fetchCompanyClausesList } from '../api/clausesApi'
import { validateClauseContentJsonClient } from '../utils/clauseContentJson'
import { selectEnrichedProfile, selectEnrichedNavigation } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import '../pages/ClauseForm.css'

const LIST_PATH_STANDARD = '/app/gestion-contratos/templates-estandar'
const LIST_PATH_COMPANY = '/app/gestion-contratos/templates-por-empresa'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function normalizeContentJson(raw) {
  if (raw == null) return EMPTY_DOC
  if (typeof raw === 'object' && !Array.isArray(raw) && raw.type) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.type) return parsed
    } catch {
      /* ignore */
    }
  }
  return EMPTY_DOC
}

/**
 * @param {{ accessToken: string | null, mode: 'create' | 'edit', templateId?: string, scope?: 'standard' | 'company', companyId?: string | null }} props
 */
export function StandardTemplateEditor({
  accessToken,
  mode,
  templateId,
  scope = 'standard',
  companyId = null,
}) {
  const navigate = useNavigate()
  const profile = useSelector(selectEnrichedProfile)
  const navigation = useSelector(selectEnrichedNavigation)
  const grantedCodeSet = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  /** Alineado con GET /api/clauses/universal (exige este código en el backend). */
  const canListUniversalClauses = grantedCodeSet.has('NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ')
  /** Alineado con GET /api/clauses/company. */
  const canListCompanyClauses = grantedCodeSet.has('NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ')

  const listPath = scope === 'company' ? LIST_PATH_COMPANY : LIST_PATH_STANDARD
  const listLabel = scope === 'company' ? 'Templates por empresa' : 'Templates estándar'

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('draft')
  const [contentJson, setContentJson] = useState(null)
  const [clauseOptions, setClauseOptions] = useState([])
  const [companyClauseOptions, setCompanyClauseOptions] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [auditMeta, setAuditMeta] = useState({
    created_by: null,
    created_by_name: null,
    last_edited_by: null,
    last_edited_by_name: null,
    updated_at: null,
  })

  const defaultAuthorLabel = auditPersonLabel(profile?.label, null)
  const defaultUpdatedAtLabel = formatAuditDateTime(new Date())

  const companyScopeMissing = scope === 'company' && !isNonEmptyString(companyId)

  useEffect(() => {
    let active = true
    async function loadClauses() {
      if (!accessToken || !canListUniversalClauses) {
        if (active) setClauseOptions([])
        return
      }
      const res = await fetchUniversalClausesList({ accessToken })
      if (!active || !res.ok) return
      const list = res.data?.items
      setClauseOptions(Array.isArray(list) ? list : [])
    }
    loadClauses()
    return () => {
      active = false
    }
  }, [accessToken, canListUniversalClauses])

  useEffect(() => {
    let active = true
    async function loadCompanyClauses() {
      if (!accessToken || !canListCompanyClauses || scope !== 'company' || !isNonEmptyString(companyId)) {
        setCompanyClauseOptions([])
        return
      }
      const res = await fetchCompanyClausesList({ accessToken, companyId: companyId.trim() })
      if (!active || !res.ok) return
      const list = res.data?.items
      setCompanyClauseOptions(Array.isArray(list) ? list : [])
    }
    loadCompanyClauses()
    return () => {
      active = false
    }
  }, [accessToken, canListCompanyClauses, scope, companyId])

  useEffect(() => {
    if (mode !== 'edit' || !templateId || !accessToken) {
      return
    }
    if (companyScopeMissing) {
      const t = window.setTimeout(() => {
        setLoading(false)
        setLoadError('Seleccione una empresa para cargar la plantilla.')
      }, 0)
      return () => window.clearTimeout(t)
    }
    let active = true
    async function loadTemplate() {
      setLoading(true)
      setLoadError(null)
      const res =
        scope === 'company'
          ? await fetchCompanyTemplateById(templateId, { accessToken, companyId: companyId.trim() })
          : await fetchStandardTemplateById(templateId, { accessToken })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setLoadError(res.message ?? 'No se pudo cargar la plantilla.')
        return
      }
      const t = res.data
      if (!t || typeof t !== 'object') {
        setLoadError('Respuesta inválida del servidor.')
        return
      }
      setName(typeof t.name === 'string' ? t.name : '')
      setCode(typeof t.code === 'string' ? t.code : '')
      setDescription(typeof t.description === 'string' ? t.description : '')
      setStatus(['draft', 'active', 'inactive'].includes(t.status) ? t.status : 'draft')
      setContentJson(normalizeContentJson(t.content_json))
      setAuditMeta({
        created_by: t.created_by ?? null,
        created_by_name: t.created_by_name ?? null,
        last_edited_by: t.last_edited_by ?? null,
        last_edited_by_name: t.last_edited_by_name ?? null,
        updated_at: t.updated_at ?? null,
      })
    }
    loadTemplate()
    return () => {
      active = false
    }
  }, [mode, templateId, accessToken, scope, companyId, companyScopeMissing])

  const authorReadOnly = useMemo(() => {
    if (mode === 'edit') return auditPersonLabel(auditMeta.created_by_name, auditMeta.created_by)
    return defaultAuthorLabel
  }, [mode, auditMeta, defaultAuthorLabel])

  const lastEditorReadOnly = useMemo(() => {
    if (mode === 'edit') return auditPersonLabel(auditMeta.last_edited_by_name, auditMeta.last_edited_by)
    return defaultAuthorLabel
  }, [mode, auditMeta, defaultAuthorLabel])

  const updatedAtReadOnly = useMemo(() => {
    if (mode === 'edit') return formatAuditDateTime(auditMeta.updated_at)
    return defaultUpdatedAtLabel
  }, [mode, auditMeta, defaultUpdatedAtLabel])

  const canSubmit = useMemo(
    () =>
      isNonEmptyString(name) &&
      isNonEmptyString(code) &&
      !!accessToken &&
      !loading &&
      !loadError &&
      !(scope === 'company' && !isNonEmptyString(companyId)),
    [name, code, accessToken, loading, loadError, scope, companyId]
  )

  const onSubmit = useCallback(async () => {
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

    const payload = {
      name: name.trim(),
      code: code.trim(),
      description: description.trim().length ? description.trim() : null,
      content_json: contentJson,
      status: mode === 'create' ? 'draft' : status,
    }

    const res =
      scope === 'company'
        ? mode === 'edit' && templateId
          ? await updateCompanyTemplate(templateId, payload, { accessToken, companyId: companyId.trim() })
          : await createCompanyTemplate(payload, { accessToken, companyId: companyId.trim() })
        : mode === 'edit' && templateId
          ? await updateStandardTemplate(templateId, payload, { accessToken })
          : await createStandardTemplate(payload, { accessToken })

    setSubmitting(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo guardar la plantilla.')
      return
    }
    if (mode === 'edit' && res.data && typeof res.data === 'object') {
      const t = res.data
      setAuditMeta({
        created_by: t.created_by ?? null,
        created_by_name: t.created_by_name ?? null,
        last_edited_by: t.last_edited_by ?? null,
        last_edited_by_name: t.last_edited_by_name ?? null,
        updated_at: t.updated_at ?? null,
      })
    }
    setSuccess(mode === 'edit' ? 'La plantilla se actualizó correctamente.' : 'La plantilla se creó correctamente.')
    window.setTimeout(() => {
      navigate(listPath)
    }, 900)
  }, [
    accessToken,
    canSubmit,
    companyId,
    contentJson,
    description,
    mode,
    name,
    code,
    navigate,
    listPath,
    scope,
    status,
    templateId,
  ])

  const breadcrumb = useMemo(
    () => [
      { label: listLabel, to: listPath },
      { label: mode === 'edit' ? 'Editar' : 'Nuevo template' },
    ],
    [listLabel, listPath, mode]
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="clause-button" onClick={onSubmit} disabled={!canSubmit || submitting}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [canSubmit, onSubmit, submitting]
  )

  const showForm = !loading && !loadError && !companyScopeMissing

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {companyScopeMissing ? (
            <div className="clause-error">Seleccione una empresa en el subencabezado para continuar.</div>
          ) : null}
          {loading ? <div className="clause-list-loading">Cargando…</div> : null}
          {loadError ? <div className="clause-error">{loadError}</div> : null}
          {success ? <div className="clause-success">{success}</div> : null}
          {error ? <div className="clause-error">{error}</div> : null}

          {showForm ? (
            <>
              <ClauseTemplateMetadataPanel
                defaultExpanded={mode === 'create'}
                code={code}
                primaryLabel={name}
                entityKind="template"
              >
                <div className={mode === 'create' ? 'clause-form-row clause-form-row--audit-four' : 'clause-form-row clause-form-row--audit-three'}>
                  <div className="clause-form-col">
                    <div className="clause-label">Autor</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={authorReadOnly} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Último editor</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={lastEditorReadOnly} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Fecha último cambio</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={updatedAtReadOnly} />
                  </div>
                  {mode === 'create' ? (
                    <div className="clause-form-col">
                      <div className="clause-label">Estado</div>
                      <input
                        readOnly
                        tabIndex={-1}
                        className="clause-input clause-input--readonly"
                        value={mapClauseStatusToSpanish('draft')}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="clause-form-row clause-form-row--two-col">
                  <div className="clause-form-col">
                    <div className="clause-label">Nombre</div>
                    <input
                      className="clause-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nombre de la plantilla"
                    />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Código</div>
                    <input
                      className="clause-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={scope === 'company' ? 'Ej: PLANTILLA-EMP-A001' : 'Ej: PLANTILLA-A001'}
                    />
                  </div>
                </div>

                {mode === 'edit' ? (
                  <div className="clause-form-row">
                    <div className="clause-label">Estado</div>
                    <select className="clause-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="draft">Borrador</option>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                ) : null}

                <div className="clause-form-row">
                  <div className="clause-label">Descripción</div>
                  <textarea
                    className="clause-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Descripción opcional"
                  />
                </div>
              </ClauseTemplateMetadataPanel>

              <div className="clause-form-row clause-form-row--editor">
                <div className="clause-label">Contenido</div>
                <RichTextEditor
                  variant="document"
                  content={contentJson ?? EMPTY_DOC}
                  onChange={(json) => setContentJson(json)}
                  enableEmbeddedUniversalClauses={canListUniversalClauses}
                  embeddedUniversalClausesOptions={clauseOptions}
                  enableEmbeddedCompanyClauses={scope === 'company' && canListCompanyClauses}
                  embeddedCompanyClausesOptions={companyClauseOptions}
                  embeddedClauseCompanyId={scope === 'company' && isNonEmptyString(companyId) ? companyId.trim() : null}
                  accessToken={accessToken}
                  clauseCatalogMode={scope === 'company' ? 'unified' : 'split'}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
