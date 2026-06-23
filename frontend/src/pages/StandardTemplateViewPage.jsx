import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate, useParams } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { PageShell } from '../components/PageShell'
import { ClauseTemplateMetadataPanel } from '../components/ClauseTemplateMetadataPanel'
import { fetchStandardTemplateById } from '../api/standardTemplatesApi'
import { AbilityContext } from '../lib/ability'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapTemplateStatusToSpanish } from '../utils/templateStatus'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import '../styles/shared-form.css'

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
  const ability = useAbility(AbilityContext)

  const canEdit = ability.can('update', 'Template')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entity, setEntity] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!id) return
      setLoading(true)
      setError(null)
      const res = await fetchStandardTemplateById(id, {})
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
  }, [id])

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
      { label: 'Plantillas', to: LIST_PATH },
      { label: 'Ver' },
    ],
    []
  )

  const subActions = useMemo(
    () =>
      entity && canEdit ? (
        <button type="button" className="btn" onClick={() => navigate('edit', { relative: 'path' })}>
          Editar
        </button>
      ) : null,
    [canEdit, entity, navigate]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
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
                <div className="clause-form-row clause-form-row--audit-four">
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
                  <div className="clause-form-col">
                    <div className="clause-label">Estado</div>
                    <input
                      readOnly
                      tabIndex={-1}
                      className="clause-input clause-input--readonly"
                      value={mapTemplateStatusToSpanish(entity.status)}
                    />
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
                  <div className="clause-label">Tipo de proveedor</div>
                  <SupplierTypeChip supplierType={entity.supplier_type} />
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
                  readOnly
                  variant="document"
                  content={normalizeContentJson(entity.content_json)}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
