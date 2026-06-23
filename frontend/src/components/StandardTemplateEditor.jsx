import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from './RichTextEditor'
import TemplateCopyFromCatalog from './RichTextEditor/TemplateCopyFromCatalog'
import { ConfirmDialog } from './ConfirmDialog'
import { PageShell } from './PageShell'
import { ClauseTemplateMetadataPanel } from './ClauseTemplateMetadataPanel'
import { createStandardTemplate, fetchStandardTemplateById, updateStandardTemplate } from '../api/standardTemplatesApi'
import { validateTemplateContentJsonClient } from '../utils/templateContentJson'
import { selectEnrichedProfile } from '../store/authSlice'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapTemplateStatusToSpanish } from '../utils/templateStatus'
import { SupplierTypeChip } from './SupplierTypeChip'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { formDirtySnapshot, isFormDirty } from '../utils/formDirtySnapshot'
import '../styles/shared-form.css'

const LIST_PATH = '/app/gestion-contratos/templates-estandar'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

const VALID_SUPPLIER_TYPES = ['persona_natural', 'empresa']

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidSupplierType(v) {
  return VALID_SUPPLIER_TYPES.includes(v)
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

function cloneContentJson(doc) {
  return normalizeContentJson(JSON.parse(JSON.stringify(doc ?? EMPTY_DOC)))
}

function isEmptyEditorDoc(doc) {
  const normalized = normalizeContentJson(doc)
  if (!Array.isArray(normalized.content) || normalized.content.length === 0) return true
  if (normalized.content.length !== 1) return false
  const first = normalized.content[0]
  if (!first || first.type !== 'paragraph') return false
  return !Array.isArray(first.content) || first.content.length === 0
}

function buildFormFields({ name, code, description, status, supplierType, contentJson }) {
  return {
    name: (name ?? '').trim(),
    code: (code ?? '').trim(),
    description: (description ?? '').trim(),
    status: status ?? 'inactive',
    supplierType: supplierType ?? 'persona_natural',
    contentJson: contentJson ?? EMPTY_DOC,
  }
}

/**
 * @param {{ accessToken: string | null, mode: 'create' | 'edit', templateId?: string }} props
 */
export function StandardTemplateEditor({ mode, templateId }) {
  const navigate = useNavigate()
  const profile = useSelector(selectEnrichedProfile)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('inactive')
  const [supplierType, setSupplierType] = useState('persona_natural')
  const [contentJson, setContentJson] = useState(null)
  const [contentVersion, setContentVersion] = useState(0)
  const [isCopyFromOpen, setIsCopyFromOpen] = useState(false)
  const [copyFromLoading, setCopyFromLoading] = useState(false)
  const [copyFromError, setCopyFromError] = useState(null)
  const [copyFromConfirmOpen, setCopyFromConfirmOpen] = useState(false)
  const [pendingCopyTemplate, setPendingCopyTemplate] = useState(null)
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

  /** Evita recargar desde el servidor al refrescar el token OIDC (SessionKeepAlive). */
  const loadedTemplateIdRef = useRef(null)
  const [savedSnapshot, setSavedSnapshot] = useState(null)

  const currentFormFields = useMemo(
    () => buildFormFields({ name, code, description, status, supplierType, contentJson }),
    [name, code, description, status, supplierType, contentJson]
  )

  const isDirty = useMemo(
    () => isFormDirty(savedSnapshot, currentFormFields),
    [savedSnapshot, currentFormFields]
  )

  useEffect(() => {
    if (mode === 'create' && savedSnapshot == null && !loading) {
      setSavedSnapshot(formDirtySnapshot(currentFormFields))
    }
  }, [mode, loading, savedSnapshot, currentFormFields])

  useEffect(() => {
    if (mode !== 'edit' || !templateId) {
      return
    }
    if (loadedTemplateIdRef.current === templateId) {
      return
    }

    let active = true
    async function loadTemplate() {
      setLoading(true)
      setLoadError(null)
      const res = await fetchStandardTemplateById(templateId, {})
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
      loadedTemplateIdRef.current = templateId
      const loadedFields = buildFormFields({
        name: typeof t.name === 'string' ? t.name : '',
        code: typeof t.code === 'string' ? t.code : '',
        description: typeof t.description === 'string' ? t.description : '',
        status: ['active', 'inactive'].includes(t.status) ? t.status : 'inactive',
        supplierType: isValidSupplierType(t.supplier_type) ? t.supplier_type : 'persona_natural',
        contentJson: normalizeContentJson(t.content_json),
      })
      setSavedSnapshot(formDirtySnapshot(loadedFields))
      setName(loadedFields.name)
      setCode(loadedFields.code)
      setDescription(loadedFields.description)
      setStatus(loadedFields.status)
      setSupplierType(loadedFields.supplierType)
      setContentJson(loadedFields.contentJson)
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
  }, [mode, templateId])

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
      isValidSupplierType(supplierType) &&
      !loading &&
      !loadError,
    [name, code, supplierType, loading, loadError]
  )

  const showForm = !loading && !loadError

  const saveForm = useCallback(
    async ({ navigateAfter = false } = {}) => {
      if (!canSubmit) return false
      const contentCheck = validateTemplateContentJsonClient(contentJson)
      if (!contentCheck.ok) {
        setError(contentCheck.message)
        setSuccess(null)
        return false
      }
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const payload = {
        name: name.trim(),
        code: code.trim(),
        description: description.trim().length ? description.trim() : null,
        content_json: contentJson,
        status,
        supplier_type: supplierType,
      }

      const res =
        mode === 'edit' && templateId
          ? await updateStandardTemplate(templateId, payload, {})
          : await createStandardTemplate(payload, {})

      setSubmitting(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo guardar la plantilla.')
        return false
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
      setSavedSnapshot(formDirtySnapshot(currentFormFields))
      if (navigateAfter) {
        setSuccess(mode === 'edit' ? 'La plantilla se actualizó correctamente.' : 'La plantilla se creó correctamente.')
        window.setTimeout(() => {
          navigate(LIST_PATH)
        }, 900)
      }
      return true
    },
    [
      canSubmit,
      contentJson,
      currentFormFields,
      description,
      mode,
      name,
      code,
      navigate,
      status,
      supplierType,
      templateId,
    ]
  )

  const onSubmit = useCallback(() => {
    void saveForm({ navigateAfter: true })
  }, [saveForm])

  const { dialog: unsavedChangesDialog } = useUnsavedChangesGuard({
    isDirty: isDirty && showForm,
    onSave: () => saveForm({ navigateAfter: false }),
    enabled: showForm,
    title: 'Cambios sin guardar',
    message: 'Tiene cambios sin guardar en esta plantilla. ¿Desea guardarlos antes de salir?',
  })

  const applyCopiedContent = useCallback((nextContent) => {
    const cloned = cloneContentJson(nextContent)
    setContentJson(cloned)
    setContentVersion((version) => version + 1)
    setCopyFromError(null)
  }, [])

  const loadTemplateContentForCopy = useCallback(
    async (template) => {
      if (!template?.id) return
      setCopyFromLoading(true)
      setCopyFromError(null)
      const res = await fetchStandardTemplateById(template.id, {})
      setCopyFromLoading(false)
      if (!res.ok) {
        setCopyFromError(res.message ?? 'No se pudo cargar el contenido de la plantilla.')
        return
      }
      const source = res.data
      if (!source || typeof source !== 'object') {
        setCopyFromError('Respuesta inválida del servidor.')
        return
      }
      applyCopiedContent(normalizeContentJson(source.content_json))
    },
    [applyCopiedContent]
  )

  const handleCopyFromSelect = useCallback(
    (template) => {
      if (!template?.id) return
      if (!isEmptyEditorDoc(contentJson)) {
        setPendingCopyTemplate(template)
        setCopyFromConfirmOpen(true)
        return
      }
      void loadTemplateContentForCopy(template)
    },
    [contentJson, loadTemplateContentForCopy]
  )

  const handleCopyFromConfirm = useCallback(() => {
    const template = pendingCopyTemplate
    setCopyFromConfirmOpen(false)
    setPendingCopyTemplate(null)
    if (!template) return
    void loadTemplateContentForCopy(template)
  }, [loadTemplateContentForCopy, pendingCopyTemplate])

  const handleCopyFromCancel = useCallback(() => {
    setCopyFromConfirmOpen(false)
    setPendingCopyTemplate(null)
  }, [])

  const breadcrumb = useMemo(
    () => [
      { label: 'Plantillas', to: LIST_PATH },
      { label: mode === 'edit' ? 'Editar' : 'Nueva plantilla' },
    ],
    [mode]
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="btn" onClick={onSubmit} disabled={!canSubmit || submitting}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [canSubmit, onSubmit, submitting]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      {unsavedChangesDialog}
      <ConfirmDialog
        open={copyFromConfirmOpen}
        title="Reemplazar contenido"
        message={
          pendingCopyTemplate
            ? `El editor ya tiene contenido. ¿Desea reemplazarlo con el de "${pendingCopyTemplate.code || pendingCopyTemplate.name || 'la plantilla seleccionada'}"?`
            : 'El editor ya tiene contenido. ¿Desea reemplazarlo?'
        }
        confirmText="Reemplazar"
        cancelText="Cancelar"
        destructive
        onConfirm={handleCopyFromConfirm}
        onCancel={handleCopyFromCancel}
      />
      <TemplateCopyFromCatalog
        isOpen={isCopyFromOpen}
        onClose={() => setIsCopyFromOpen(false)}
        onTemplateSelect={handleCopyFromSelect}
        excludeTemplateId={mode === 'edit' ? templateId : null}
      />
      <div className="ph-card clause-card">
        <div className="clause-form">
          {loading ? <div className="clause-list-loading">Cargando…</div> : null}
          {loadError ? <div className="clause-error">{loadError}</div> : null}
          {success ? <div className="clause-success">{success}</div> : null}
          {error ? <div className="clause-error">{error}</div> : null}
          {copyFromError ? <div className="clause-error">{copyFromError}</div> : null}
          {copyFromLoading ? <div className="clause-list-loading">Copiando contenido…</div> : null}

          {showForm ? (
            <>
              <ClauseTemplateMetadataPanel
                defaultExpanded={mode === 'create'}
                code={code}
                primaryLabel={name}
                entityKind="template"
              >
                <div className="clause-form-row clause-form-row--audit-four">
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
                  <div className="clause-form-col">
                    <div className="clause-label">Estado</div>
                    {mode === 'create' ? (
                      <input
                        readOnly
                        tabIndex={-1}
                        className="clause-input clause-input--readonly"
                        value={mapTemplateStatusToSpanish('inactive')}
                      />
                    ) : (
                      <select className="clause-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    )}
                  </div>
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
                      placeholder="Ej: PLANTILLA-A001"
                    />
                  </div>
                </div>

                <div className="clause-form-row">
                  <div className="clause-label">Tipo de proveedor</div>
                </div>
                <div className="clause-form-row clause-form-row--inline">
                  <label className="clause-form-label-inline">
                    <input
                      type="radio"
                      name="supplier_type"
                      value="persona_natural"
                      checked={supplierType === 'persona_natural'}
                      onChange={() => setSupplierType('persona_natural')}
                    />
                    <SupplierTypeChip supplierType="persona_natural" />
                  </label>
                  <label className="clause-form-label-inline">
                    <input
                      type="radio"
                      name="supplier_type"
                      value="empresa"
                      checked={supplierType === 'empresa'}
                      onChange={() => setSupplierType('empresa')}
                    />
                    <SupplierTypeChip supplierType="empresa" />
                  </label>
                </div>

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
                  contentVersion={contentVersion}
                  onChange={(json) => setContentJson(json)}
                  onCopyFromButtonClick={() => setIsCopyFromOpen(true)}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
