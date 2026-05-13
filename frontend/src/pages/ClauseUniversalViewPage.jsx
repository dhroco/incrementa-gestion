import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { PageShell } from '../components/PageShell'
import { ClauseTemplateMetadataPanel } from '../components/ClauseTemplateMetadataPanel'
import { fetchClauseDetail } from '../api/clausesApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { auditPersonLabel, formatAuditDateTime } from '../utils/auditMetadataDisplay'
import { mapClauseStatusToSpanish } from '../utils/clauseStatus'
import './ClauseForm.css'

export function ClauseUniversalViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null

  const canEdit = useMemo(
    () => buildGrantedCodeSetFromSession(navigation).has('NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT'),
    [navigation]
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entity, setEntity] = useState(null)

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
        setEntity(null)
        return
      }
      if (res.data?.type && res.data.type !== 'universal') {
        setError('Esta cláusula no es universal.')
        setEntity(null)
        return
      }
      setEntity(res.data)
    }
    run()
    return () => {
      active = false
    }
  }, [id, accessToken])

  const listPath = '/app/gestion-contratos/clausulas-universales'

  const authorLabel = useMemo(
    () => auditPersonLabel(entity?.created_by_name, entity?.created_by),
    [entity]
  )
  const lastEditorLabel = useMemo(
    () => auditPersonLabel(entity?.last_edited_by_name, entity?.last_edited_by),
    [entity]
  )
  const updatedAtLabel = useMemo(() => formatAuditDateTime(entity?.updated_at), [entity])

  const breadcrumb = useMemo(
    () => [
      { label: 'Cláusulas universales', to: listPath },
      { label: 'Ver' }
    ],
    [listPath]
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
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : entity ? (
            <>
              <ClauseTemplateMetadataPanel
                defaultExpanded={false}
                code={entity.code ?? ''}
                primaryLabel={entity.title_clause ?? ''}
                entityKind="clause"
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

                <div className="clause-form-row clause-form-row--three-col">
                  <div className="clause-form-col">
                    <div className="clause-label">Título</div>
                    <input
                      readOnly
                      tabIndex={-1}
                      className="clause-input clause-input--readonly"
                      value={entity.title_clause ?? '—'}
                    />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Código</div>
                    <input readOnly tabIndex={-1} className="clause-input clause-input--readonly" value={entity.code ?? '—'} />
                  </div>
                  <div className="clause-form-col">
                    <div className="clause-label">Estado</div>
                    <input
                      readOnly
                      tabIndex={-1}
                      className="clause-input clause-input--readonly"
                      value={mapClauseStatusToSpanish(entity.status)}
                    />
                  </div>
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
                  key={entity.id}
                  readOnly
                  variant="document"
                  content={entity.content_json ?? { type: 'doc', content: [] }}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
