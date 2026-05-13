import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchEmployeesList } from '../api/employeesApi'
import {
  fetchDocumentBuilderTemplates,
  postDocumentBuilderGenerate,
  downloadDocumentBuilderPdf
} from '../api/documentBuilderApi'
import { selectEnrichedCompany, selectSession } from '../store/authSlice'
import {
  clearMissingFields,
  resetDocumentBuilder,
  setGeneratedDocuments,
  setMissingField,
  setTemplateSelected,
  setWorkersSelected,
  toggleWorkerId
} from '../store/documentBuilderSlice'
import { useEmployeeCompanyScope } from './useEmployeeCompanyScope'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { selectEnrichedNavigation } from '../store/authSlice'
import { selectAssignedCompanies } from '../store/sessionCompanySlice'
import './DocumentBuilderPage.css'

export function DocumentBuilderPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null
  const { companyId, blocked, message: scopeMessage } = useEmployeeCompanyScope()
  const companyName = useMemo(() => {
    const direct =
      typeof enrichedCompany?.business_name === 'string' && enrichedCompany.business_name.trim()
        ? enrichedCompany.business_name.trim()
        : null
    if (direct) return direct
    const fromAssigned =
      companyId && Array.isArray(assignedCompanies)
        ? assignedCompanies.find((c) => c && c.id === companyId)?.business_name ?? null
        : null
    return typeof fromAssigned === 'string' && fromAssigned.trim() ? fromAssigned.trim() : 'Empresa'
  }, [assignedCompanies, companyId, enrichedCompany?.business_name])

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canUse = grantedCodes.has('NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO')

  const workersSelected = useSelector((s) => s.documentBuilder.workersSelected)
  const templateSelected = useSelector((s) => s.documentBuilder.templateSelected)
  const generatedDocuments = useSelector((s) => s.documentBuilder.generatedDocuments)
  const missingFields = useSelector((s) => s.documentBuilder.missingFields)

  const [employees, setEmployees] = useState([])
  const [templates, setTemplates] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [error, setError] = useState(null)
  const [generatingPdfLib, setGeneratingPdfLib] = useState(false)
  const [generatingReactPdf, setGeneratingReactPdf] = useState(false)
  const [downloadErrors, setDownloadErrors] = useState({})

  const stage1Ok = workersSelected.length > 0
  const stage2Ok = Boolean(templateSelected?.id && templateSelected?.kind)
  const stage3Ok = generatedDocuments.length > 0

  const lastCompanyIdRef = useRef(null)
  useEffect(() => {
    if (!companyId) return
    const prev = lastCompanyIdRef.current
    if (prev && prev !== companyId) {
      dispatch(resetDocumentBuilder())
    }
    lastCompanyIdRef.current = companyId
  }, [dispatch, companyId])

  useEffect(() => {
    let active = true
    async function run() {
      if (!accessToken || !companyId || !canUse || blocked) {
        setEmployees([])
        return
      }
      setLoadingEmployees(true)
      setError(null)
      const res = await fetchEmployeesList({ companyId, q: '', accessToken })
      if (!active) return
      setLoadingEmployees(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar trabajadores.')
        setEmployees([])
        return
      }
      const list = res.data?.items
      setEmployees(Array.isArray(list) ? list : [])
    }
    run()
    return () => {
      active = false
    }
  }, [accessToken, companyId, canUse, blocked])

  useEffect(() => {
    let active = true
    async function run() {
      if (!accessToken || !companyId || !canUse || blocked || !stage1Ok) {
        setTemplates([])
        return
      }
      setLoadingTemplates(true)
      const res = await fetchDocumentBuilderTemplates({ companyId, accessToken })
      if (!active) return
      setLoadingTemplates(false)
      if (!res.ok) {
        setTemplates([])
        return
      }
      const items = res.data?.items
      setTemplates(Array.isArray(items) ? items : [])
    }
    run()
    return () => {
      active = false
    }
  }, [accessToken, companyId, canUse, blocked, stage1Ok])

  const allSelected =
    employees.length > 0 && employees.every((e) => workersSelected.includes(String(e.id)))

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      dispatch(setWorkersSelected([]))
    } else {
      dispatch(setWorkersSelected(employees.map((e) => String(e.id))))
    }
  }, [allSelected, dispatch, employees])

  const selectedTemplateName = useMemo(() => {
    if (!templateSelected?.id || !templateSelected?.kind) return ''
    const it = templates.find(
      (t) => t && t.kind === templateSelected.kind && String(t.id) === String(templateSelected.id)
    )
    return typeof it?.name === 'string' ? it.name : ''
  }, [templateSelected, templates])

  const runGenerate = useCallback(
    async (renderEngine) => {
      if (!accessToken || !companyId || !stage1Ok || !stage2Ok) return
      const setBusy = renderEngine === 'react-pdf' ? setGeneratingReactPdf : setGeneratingPdfLib
      setBusy(true)
      setError(null)
      const body = {
        employeeIds: workersSelected,
        template: templateSelected,
        missingFieldOverrides: missingFields
      }
      if (renderEngine) {
        body.renderEngine = renderEngine
      }
      const res = await postDocumentBuilderGenerate(body, { companyId, accessToken })
      setBusy(false)
      if (res.ok) {
        const docs = res.data?.documents
        dispatch(setGeneratedDocuments(Array.isArray(docs) ? docs : []))
        dispatch(clearMissingFields())
        return
      }
      if (res.status === 422 && Array.isArray(res.missingFieldKeys)) {
        for (const k of res.missingFieldKeys) {
          dispatch(setMissingField({ key: k, value: missingFields[k] ?? '' }))
        }
        setError('Complete los datos faltantes y vuelva a generar.')
        return
      }
      setError(res.message ?? 'No se pudo generar los documentos.')
    },
    [accessToken, companyId, dispatch, missingFields, stage1Ok, stage2Ok, templateSelected, workersSelected]
  )

  const onDownload = useCallback(
    async (doc) => {
      if (!accessToken || !companyId) return
      setDownloadErrors((prev) => ({ ...prev, [doc.id]: null }))
      try {
        const blob = await downloadDocumentBuilderPdf({
          documentId: doc.id,
          companyId,
          accessToken
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.file_name || 'documento.pdf'
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        const msg = e && typeof e === 'object' && e.message ? String(e.message) : 'Error al descargar.'
        setDownloadErrors((prev) => ({ ...prev, [doc.id]: msg }))
      }
    },
    [accessToken, companyId]
  )

  const breadcrumb = useMemo(() => [{ label: 'Constructor de documento' }], [])

  if (!canUse) {
    return (
      <PageShell title="Constructor de documento" breadcrumb={breadcrumb} className="document-builder-page">
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para usar el constructor de documento.</div>
        </div>
      </PageShell>
    )
  }

  if (blocked) {
    return (
      <PageShell title="Constructor de documento" breadcrumb={breadcrumb} className="document-builder-page">
        <div className="clause-list-card">
          <div className="clause-error">{scopeMessage ?? 'Sin empresa en contexto.'}</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Constructor de documento" breadcrumb={breadcrumb} className="document-builder-page">
      {error ? <div className="clause-error document-builder-banner">{error}</div> : null}

      <section className={`db-card ${stage1Ok ? 'db-card--done' : ''}`}>
        <h2 className="db-card__title">1. Selección de trabajadores</h2>
        <p className="db-card__hint">Seleccione al menos un trabajador de la empresa.</p>
        {loadingEmployees ? (
          <div className="db-muted">Cargando…</div>
        ) : (
          <>
            <label className="db-row">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={employees.length === 0} />
              <span>Seleccionar todos</span>
            </label>
            <div className="db-list">
              {employees.map((e) => (
                <label key={e.id} className="db-row">
                  <input
                    type="checkbox"
                    checked={workersSelected.includes(String(e.id))}
                    onChange={() => dispatch(toggleWorkerId(String(e.id)))}
                  />
                  <span>
                    {e.full_name} <span className="db-muted">({e.rut})</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={`db-card ${!stage1Ok ? 'db-card--locked' : ''} ${stage2Ok ? 'db-card--done' : ''}`}>
        <h2 className="db-card__title">2. Selección de plantilla</h2>
        <p className="db-card__hint">Elija una plantilla estándar o de empresa.</p>
        {!stage1Ok ? <p className="db-muted">Complete el paso anterior para habilitar esta sección.</p> : null}
        {stage1Ok && loadingTemplates ? <div className="db-muted">Cargando plantillas…</div> : null}
        {stage1Ok && !loadingTemplates ? (
          <div className="db-template-sections">
            <div className="db-section">
              <div className="db-section__box" role="group" aria-label="Templates estándar">
                <div className="db-section__title">Templates estándar</div>
                <div className="db-list">
                  {templates
                    .filter((t) => t && t.kind === 'standard')
                    .map((t) => {
                      const selected =
                        templateSelected?.kind === t.kind && String(templateSelected?.id) === String(t.id)
                      return (
                        <label key={`${t.kind}-${t.id}`} className="db-row">
                          <input
                            type="radio"
                            name="tpl"
                            checked={selected}
                            disabled={!stage1Ok}
                            onChange={() => dispatch(setTemplateSelected({ kind: t.kind, id: String(t.id) }))}
                          />
                          <span>{t.name}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            </div>

            <div className="db-section">
              <div className="db-section__box" role="group" aria-label="Templates por empresa">
                <div className="db-section__title">
                  Templates por empresa{' '}
                  <span className="db-section__subtitle">
                    {companyName}
                  </span>
                </div>
                <div className="db-list">
                  {templates
                    .filter((t) => t && t.kind === 'company')
                    .map((t) => {
                      const selected =
                        templateSelected?.kind === t.kind && String(templateSelected?.id) === String(t.id)
                      return (
                        <label key={`${t.kind}-${t.id}`} className="db-row">
                          <input
                            type="radio"
                            name="tpl"
                            checked={selected}
                            disabled={!stage1Ok}
                            onChange={() => dispatch(setTemplateSelected({ kind: t.kind, id: String(t.id) }))}
                          />
                          <span>{t.name}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {stage1Ok ? (
          <div className="db-actions db-actions--stacked">
            <div className="db-selected-template" aria-label="Plantilla seleccionada">
              <div className="db-selected-template__label">Plantilla seleccionada</div>
              <div className="db-selected-template__value">{selectedTemplateName || '—'}</div>
            </div>
            <button
              type="button"
              className="clause-button"
              disabled={!stage2Ok}
              onClick={() => navigate('/app/gestion-contratos/constructor-documento/preview')}
            >
              Ver preview
            </button>
          </div>
        ) : null}
      </section>

      <section className={`db-card ${!stage2Ok ? 'db-card--locked' : ''} ${stage3Ok ? 'db-card--done' : ''}`}>
        <h2 className="db-card__title">3. Generación del documento (PDF)</h2>
        {!stage2Ok ? <p className="db-muted">Complete los pasos anteriores para habilitar esta sección.</p> : null}
        {stage2Ok && Object.keys(missingFields).length > 0 ? (
          <div className="db-missing">
            <p className="db-card__hint">Datos adicionales requeridos:</p>
            {Object.keys(missingFields).map((key) => (
              <label key={key} className="db-field">
                <span>{key}</span>
                <input
                  type="text"
                  value={missingFields[key] ?? ''}
                  onChange={(e) => dispatch(setMissingField({ key, value: e.target.value }))}
                />
              </label>
            ))}
          </div>
        ) : null}
        {stage2Ok ? (
          <div className="db-actions">
            <button
              type="button"
              className="clause-button"
              disabled={generatingPdfLib}
              onClick={() => void runGenerate(undefined)}
            >
              {generatingPdfLib ? 'Generando…' : 'Generar PDFs y guardar'}
            </button>
            <button
              type="button"
              className="clause-button"
              disabled={generatingReactPdf}
              onClick={() => void runGenerate('react-pdf')}
            >
              {generatingReactPdf ? 'Generando…' : 'Generar PDF con React y Guardar'}
            </button>
          </div>
        ) : null}
      </section>

      <section className={`db-card ${!stage3Ok ? 'db-card--locked' : ''}`}>
        <h2 className="db-card__title">4. Almacenamiento y descarga</h2>
        {!stage3Ok ? (
          <p className="db-muted">Los documentos generados aparecerán aquí para descargar.</p>
        ) : (
          <ul className="db-doc-list">
            {generatedDocuments.map((d) => (
              <li key={d.id} className="db-doc-row">
                <span className="db-doc-name">
                  {d.file_name}
                  {d.pdfRenderEngine ? (
                    <span className="db-muted"> ({d.pdfRenderEngine === 'react_pdf' ? 'React' : 'pdf-lib'})</span>
                  ) : null}
                </span>
                <button type="button" className="clause-button" onClick={() => void onDownload(d)}>
                  Descargar
                </button>
                {downloadErrors[d.id] ? <span className="clause-error">{downloadErrors[d.id]}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

    </PageShell>
  )
}
