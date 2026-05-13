import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { PageShell } from '../components/PageShell'
import { ClauseTemplateMetadataPanel } from '../components/ClauseTemplateMetadataPanel'
import { fetchUniversalClausesList } from '../api/clausesApi'
import { fetchStandardTemplateById } from '../api/standardTemplatesApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import './ClauseForm.css'

const LIST_PATH = '/app/gestion-contratos/templates-estandar'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

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

export function StandardTemplateViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null

  const canEdit = useMemo(
    () => buildGrantedCodeSetFromSession(navigation).has('NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT'),
    [navigation]
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entity, setEntity] = useState(null)
  const [clauseOptions, setClauseOptions] = useState([])

  useEffect(() => {
    let active = true
    async function loadClauses() {
      if (!accessToken) return
      const res = await fetchUniversalClausesList({ accessToken })
      if (!active || !res.ok) return
      const list = res.data?.items
      setClauseOptions(Array.isArray(list) ? list : [])
    }
    loadClauses()
    return () => {
      active = false
    }
  }, [accessToken])

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !accessToken) return
      setLoading(true)
      setError(null)
      const res = await fetchStandardTemplateById(id, { accessToken })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar la plantilla.')
        setEntity(null)
        return
      }
      setEntity(res.data && typeof res.data === 'object' ? res.data : null)
    }
    run()
    return () => {
      active = false
    }
  }, [id, accessToken])

  const authorLabel = useMemo(
    () => auditPersonLabel(entity?.created_by_name, entity?.created_by),
    [entity]
  )
  const lastEditorLabel = useMemo(
    () =>
      auditPersonLabel(
        entity?.last_edited_by_name ?? entity?.updated_by_name,
        entity?.last_edited_by ?? entity?.updated_by
      ),
    [entity]
  )
  const updatedAtLabel = useMemo(() => formatAuditDateTime(entity?.updated_at), [entity])

  const breadcrumb = useMemo(
    () => [
      { label: 'Templates estándar', to: LIST_PATH },
      { label: 'Ver' }
    ],
    []
  )

  const subActions = useMemo(
    () =>
      entity && canEdit ? (
        <button type="button" className="clause-button" onClick={() => navigate('edit', { relative: 'path' })}>
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
            <div className="clause-list-loading">Cargando…</div>
          ) : entity ? (
            <>
              <ClauseTemplateMetadataPanel
                defaultExpanded={false}
                code={entity.code ?? ''}
                primaryLabel={entity.name ?? ''}
                entityKind="template"
              >
                <div className="clause-form-row clause-form-row--audit-three">
                  <div className="clause-form-col">
                    <div className="clause-label">Autor</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={authorLabel} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Último editor</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={lastEditorLabel} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Fecha último cambio</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={updatedAtLabel} />
                  </div>
                </div>

                <div className="clause-form-row clause-form-row--two-col">
                  <div className="clause-form-col">
                    <div className="clause-label">Código</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={entity.code ?? '—'} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Nombre</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={entity.name ?? '—'} />
                  </div>
                </div>

                <div className="clause-form-row">
                  <div className="clause-label">Estado</div>
                  <input
                    readOnly
                    tabIndex={-1}
                    className="clause-input clause-input--readonly"
                    value={mapClauseStatusToSpanish(entity.status)}
                  />
                </div>

                <div className="clause-form-row">
                  <div className="clause-label">Descripción</div>
                  <textarea
                    readOnly
                    tabIndex={-1}
                    className="clause-textarea clause-textarea--readonly"
                    rows={3}
                    value={entity.description ?? ''}
                  />
                </div>
              </ClauseTemplateMetadataPanel>

              <div className="clause-form-row clause-form-row--editor">
                <div className="clause-label">Contenido</div>
                <RichTextEditor
                  key={`${entity.id}-${clauseOptions.length}`}
                  readOnly
                  variant="document"
                  content={normalizeContentJson(entity.content_json)}
                  enableEmbeddedUniversalClauses
                  embeddedUniversalClausesOptions={clauseOptions}
                  accessToken={accessToken}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
