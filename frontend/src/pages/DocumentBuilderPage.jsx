import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { autoFormatDate } from '../utils/dateUtils'
import { useAbility } from '@casl/react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchSuppliersList } from '../api/suppliersApi'
import { fetchClientsList } from '../api/clientsApi'
import {
  fetchDocumentBuilderTemplates,
  postDocumentBuilderGenerate,
  downloadDocumentBuilderPdf
} from '../api/documentBuilderApi'
import { AbilityContext } from '../lib/ability'
import {
  clearMissingFields,
  resetDocumentBuilder,
  setGeneratedDocuments,
  setMissingField,
  setSelectedSupplierId,
  setSelectedClientId,
  setTemplateSelected
} from '../store/documentBuilderSlice'
import { PlatformAdminCompanySelect } from '../components/PlatformAdminCompanySelect'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import { formatRutDisplay } from '../utils/rut'
import { usePlatformAdminCompaniesLoader } from './usePlatformAdminCompaniesLoader'
import { usePlatformAdminCompanyScope } from './usePlatformAdminCompanyScope'
import { ConfirmDialog } from '../components/ConfirmDialog'
import '../styles/shared-form.css'
import './DocumentBuilderPage.css'

function draftStatusLabel(status) {
  if (status === 'draft') return 'Borrador'
  if (status === 'pending_signature') return 'Pendiente de firma'
  return typeof status === 'string' && status.trim() ? status : '—'
}

function formatDraftCreatedAt(createdAt) {
  if (!createdAt) return '—'
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date)
}

function buildDuplicateDraftMessage(existing) {
  const fileName = existing?.file_name || '—'
  const createdLabel = formatDraftCreatedAt(existing?.created_at)
  const statusLabel = draftStatusLabel(existing?.status)
  return `Ya existe un contrato generado para este proveedor con esta plantilla en el mismo mes (archivo: ${fileName}, creado el ${createdLabel}, estado: ${statusLabel}). ¿Deseas reemplazarlo?`
}

function resolveSelectIndex(field, overrides) {
  if (!Array.isArray(field.options) || field.options.length === 0) return ''
  for (let i = 0; i < field.options.length; i++) {
    const opt = field.options[i]
    if (typeof opt === 'object' && opt !== null && opt.values) {
      if (Object.entries(opt.values).every(([k, v]) => overrides[k] === v)) return String(i)
    } else if (overrides[field.key] === opt) {
      return String(i)
    }
  }
  return ''
}

function MissingFieldInput({ field, value, overrides, onChange }) {
  const id = `missing-field-${field.key}`
  if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
    const selectedIndex = resolveSelectIndex(field, overrides ?? {})
    return (
      <select
        id={id}
        className="clause-input"
        value={selectedIndex}
        onChange={(e) => {
          const idx = e.target.value
          if (idx === '') {
            onChange('')
            return
          }
          const opt = field.options[Number(idx)]
          if (typeof opt === 'object' && opt !== null && opt.values) {
            onChange(opt.values)
          } else {
            onChange(String(opt))
          }
        }}
      >
        <option value="">Seleccione…</option>
        {field.options.map((opt, idx) => {
          const label = typeof opt === 'object' && opt !== null && opt.label ? opt.label : String(opt)
          return (
            <option key={idx} value={String(idx)}>
              {label}
            </option>
          )
        })}
      </select>
    )
  }
  if (field.type === 'date') {
    return (
      <input
        id={id}
        type="text"
        placeholder="dd/mm/aaaa"
        className="clause-input"
        value={value ?? ''}
        onChange={(e) => onChange(autoFormatDate(e.target.value))}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <input
        id={id}
        type="number"
        min="0"
        className="clause-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <input
      id={id}
      type="text"
      className="clause-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const PAGE_BREADCRUMB_LABEL = 'Constructor de documento'
const PAGE_TITLE = 'Generar contrato desde plantilla'

export function DocumentBuilderPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)
  const companyLoader = usePlatformAdminCompaniesLoader()
  const { companyId, blocked, needsCompanySelection, message: scopeMessage } =
    usePlatformAdminCompanyScope()

  const canUse = ability.can('use', 'DocumentBuilder')
  const canReadSuppliers = ability.can('read', 'Supplier')
  const canReadClients = ability.can('read', 'Client')

  const selectedSupplierId = useSelector((s) => s.documentBuilder.selectedSupplierId)
  const selectedClientId = useSelector((s) => s.documentBuilder.selectedClientId)
  const templateSelected = useSelector((s) => s.documentBuilder.templateSelected)
  const generatedDocuments = useSelector((s) => s.documentBuilder.generatedDocuments)
  const missingFields = useSelector((s) => s.documentBuilder.missingFields)

  const [suppliers, setSuppliers] = useState([])
  const [clients, setClients] = useState([])
  const [templates, setTemplates] = useState([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [downloadErrors, setDownloadErrors] = useState({})
  const [duplicateDraft, setDuplicateDraft] = useState(null)
  /** @type {Array<{ key: string, label: string, type: string, options?: string[] }>} */
  const [missingFieldDefs, setMissingFieldDefs] = useState([])
  /** @type {'idle' | 'loading' | 'ready' | 'needs_fields'} */
  const [dryRunStatus, setDryRunStatus] = useState('idle')

  const stage1Ok = Boolean(selectedSupplierId)
  const stageTemplateOk = Boolean(templateSelected?.id && templateSelected?.kind)
  const stageGeneratedOk = generatedDocuments.length > 0

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s && String(s.id) === String(selectedSupplierId)) ?? null,
    [suppliers, selectedSupplierId]
  )

  const selectedClient = useMemo(
    () => clients.find((c) => c && String(c.id) === String(selectedClientId)) ?? null,
    [clients, selectedClientId]
  )

  const lastCompanyIdRef = useRef(null)
  const lastSupplierIdRef = useRef(null)
  useEffect(() => {
    if (!companyId) return
    const prev = lastCompanyIdRef.current
    if (prev && prev !== companyId) {
      dispatch(resetDocumentBuilder())
    }
    lastCompanyIdRef.current = companyId
  }, [dispatch, companyId])

  useEffect(() => {
    const prev = lastSupplierIdRef.current
    if (prev && prev !== selectedSupplierId) {
      dispatch(setSelectedClientId(null))
      dispatch(setTemplateSelected(null))
    }
    lastSupplierIdRef.current = selectedSupplierId
  }, [dispatch, selectedSupplierId])

  useEffect(() => {
    let active = true
    async function run() {
      if (!canUse || !canReadClients || !stage1Ok) {
        setClients([])
        return
      }
      setLoadingClients(true)
      const res = await fetchClientsList({})
      if (!active) return
      setLoadingClients(false)
      if (!res.ok) {
        setClients([])
        return
      }
      const list = res.data?.items
      setClients(Array.isArray(list) ? list : [])
    }
    run()
    return () => {
      active = false
    }
  }, [canUse, canReadClients, stage1Ok])

  useEffect(() => {
    let active = true
    async function run() {
      if (!canUse || !canReadSuppliers) {
        setSuppliers([])
        return
      }
      setLoadingSuppliers(true)
      setError(null)
      const res = await fetchSuppliersList({})
      if (!active) return
      setLoadingSuppliers(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar proveedores.')
        setSuppliers([])
        return
      }
      const list = res.data?.items
      setSuppliers(Array.isArray(list) ? list : [])
    }
    run()
    return () => {
      active = false
    }
  }, [canUse, canReadSuppliers])

  useEffect(() => {
    let active = true
    async function run() {
      if (!companyId || !canUse || blocked || !stage1Ok) {
        setTemplates([])
        return
      }
      setLoadingTemplates(true)
      const res = await fetchDocumentBuilderTemplates({
        companyId,
        supplierType: selectedSupplier?.supplier_type
      })
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
  }, [companyId, canUse, blocked, stage1Ok, selectedSupplier?.supplier_type])

  const selectedTemplateName = useMemo(() => {
    if (!templateSelected?.id || !templateSelected?.kind) return ''
    const it = templates.find(
      (t) => t && t.kind === templateSelected.kind && String(t.id) === String(templateSelected.id)
    )
    return typeof it?.name === 'string' ? it.name : ''
  }, [templateSelected, templates])

  useEffect(() => {
    if (!companyId || !stage1Ok || !stageTemplateOk || !selectedSupplierId) {
      setMissingFieldDefs([])
      setDryRunStatus('idle')
      return undefined
    }

    let active = true
    dispatch(clearMissingFields())
    setMissingFieldDefs([])
    setDryRunStatus('loading')

    const body = {
      supplierId: selectedSupplierId,
      template: templateSelected,
      missingFieldOverrides: {},
      dryRun: true
    }
    if (selectedClientId) {
      body.clientId = selectedClientId
    }

    postDocumentBuilderGenerate(body, { companyId }).then((res) => {
      if (!active) return
      if (res.ok) {
        setMissingFieldDefs([])
        setDryRunStatus('ready')
        return
      }
      if (res.status === 422 && Array.isArray(res.missingFields) && res.missingFields.length > 0) {
        setMissingFieldDefs(res.missingFields)
        for (const field of res.missingFields) {
          if (field?.key) {
            dispatch(setMissingField({ key: field.key, value: '' }))
          }
        }
        setDryRunStatus('needs_fields')
        return
      }
      setDryRunStatus('idle')
      setError(res.message ?? 'No se pudo validar la plantilla.')
    })

    return () => {
      active = false
    }
  }, [
    companyId,
    dispatch,
    selectedClientId,
    selectedSupplierId,
    stage1Ok,
    stageTemplateOk,
    templateSelected
  ])

  const allMissingFieldsFilled = useMemo(() => {
    if (missingFieldDefs.length === 0) return true
    return missingFieldDefs.every((field) => {
      const value = missingFields[field.key]
      return value != null && String(value).trim() !== ''
    })
  }, [missingFieldDefs, missingFields])

  const canGenerate =
    stageTemplateOk &&
    !generating &&
    dryRunStatus !== 'loading' &&
    dryRunStatus !== 'idle' &&
    (dryRunStatus === 'ready' || (dryRunStatus === 'needs_fields' && allMissingFieldsFilled))

  const executeGenerate = useCallback(
    async ({ overwrite = false } = {}) => {
      if (!companyId || !stage1Ok || !stageTemplateOk || !selectedSupplierId) return false
      setGenerating(true)
      setError(null)
      const body = {
        supplierId: selectedSupplierId,
        template: templateSelected,
        missingFieldOverrides: missingFields
      }
      if (selectedClientId) {
        body.clientId = selectedClientId
      }
      if (overwrite) {
        body.overwrite = true
      }
      const res = await postDocumentBuilderGenerate(body, { companyId })
      setGenerating(false)
      if (res.ok) {
        if (res.data?.duplicateDraft) {
          const existing =
            res.data.existing && typeof res.data.existing === 'object'
              ? res.data.existing
              : {
                  file_name: '—',
                  created_at: null,
                  status: 'draft'
                }
          setDuplicateDraft(existing)
          return false
        }
        const docs = res.data?.documents
        dispatch(setGeneratedDocuments(Array.isArray(docs) ? docs : []))
        dispatch(clearMissingFields())
        setDuplicateDraft(null)
        return true
      }
      if (res.code === 'DUPLICATE_DRAFT') {
        const existing =
          (res.existing && typeof res.existing === 'object' ? res.existing : null) ??
          (res.meta?.existing && typeof res.meta.existing === 'object' ? res.meta.existing : null)
        setDuplicateDraft(
          existing ?? {
            file_name: '—',
            created_at: null,
            status: 'draft'
          }
        )
        return false
      }
      if (res.status === 422 && Array.isArray(res.missingFields)) {
        setMissingFieldDefs(res.missingFields)
        for (const field of res.missingFields) {
          if (field?.key) {
            dispatch(setMissingField({ key: field.key, value: missingFields[field.key] ?? '' }))
          }
        }
        setDryRunStatus('needs_fields')
        setError('Complete los datos faltantes y vuelva a generar.')
        return false
      }
      setError(res.message ?? 'No se pudo generar los documentos.')
      return false
    },
    [
      companyId,
      dispatch,
      missingFields,
      selectedSupplierId,
      selectedClientId,
      stage1Ok,
      stageTemplateOk,
      templateSelected
    ]
  )

  const runGenerate = useCallback(async () => {
    await executeGenerate()
  }, [executeGenerate])

  const onConfirmReplaceDuplicate = useCallback(async () => {
    await executeGenerate({ overwrite: true })
  }, [executeGenerate])

  const onCancelDuplicateDialog = useCallback(() => {
    setDuplicateDraft(null)
  }, [])

  const onDownload = useCallback(
    async (doc) => {
      if (!companyId) return
      setDownloadErrors((prev) => ({ ...prev, [doc.id]: null }))
      try {
        const blob = await downloadDocumentBuilderPdf({
          documentId: doc.id,
          companyId
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
    [companyId]
  )

  const breadcrumb = useMemo(() => [{ label: PAGE_BREADCRUMB_LABEL }], [])

  const companyToolbar = useMemo(
    () =>
      companyLoader.isPlatformAdmin ? (
        <PlatformAdminCompanySelect loading={companyLoader.loading} error={companyLoader.error} />
      ) : null,
    [companyLoader.error, companyLoader.isPlatformAdmin, companyLoader.loading]
  )

  if (!canUse) {
    return (
      <PageShell title={PAGE_TITLE} breadcrumb={breadcrumb} className="document-builder-page">
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para usar el constructor de documento.</div>
        </div>
      </PageShell>
    )
  }

  if (blocked) {
    return (
      <PageShell
        title={PAGE_TITLE}
        breadcrumb={breadcrumb}
        className="document-builder-page"
        localToolbar={needsCompanySelection ? companyToolbar : null}
      >
        <div className="clause-list-card">
          <div className="clause-error">{scopeMessage ?? 'Sin empresa en contexto.'}</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={PAGE_TITLE}
      breadcrumb={breadcrumb}
      className="document-builder-page"
      localToolbar={companyToolbar}
    >
      {error ? <div className="clause-error document-builder-banner">{error}</div> : null}

      <section className={`db-card ${stage1Ok ? 'db-card--done' : ''}`}>
        <h2 className="db-card__title">1. Selección de proveedor</h2>
        <p className="db-card__hint">Seleccione un proveedor (catálogo global).</p>
        {!canReadSuppliers ? (
          <div className="clause-error">No tiene permiso para listar proveedores.</div>
        ) : null}
        {canReadSuppliers && loadingSuppliers ? <div className="db-muted">Cargando…</div> : null}
        {canReadSuppliers && !loadingSuppliers ? (
          suppliers.length === 0 ? (
            <p className="db-muted">No hay proveedores registrados.</p>
          ) : (
            <div className="clause-list-table-wrap db-supplier-table-wrap">
              <table className="clause-list-table db-supplier-table" role="radiogroup" aria-label="Proveedores">
                <thead>
                  <tr>
                    <th className="db-supplier-table__col-select">
                      <span className="db-supplier-table-sr-only">Seleccionar</span>
                    </th>
                    <th>Nombre</th>
                    <th>RUT</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => {
                    const id = String(s.id)
                    const selected = selectedSupplierId === id
                    const name =
                      typeof s.display_name === 'string' && s.display_name.trim()
                        ? s.display_name.trim()
                        : s.supplier_type === 'empresa'
                          ? s.razon_social
                          : s.full_name
                    const rut = typeof s.rut === 'string' ? s.rut : ''
                    return (
                      <tr
                        key={id}
                        className={`db-supplier-table__row${selected ? ' db-supplier-table__row--selected' : ''}`}
                        onClick={() => dispatch(setSelectedSupplierId(id))}
                      >
                        <td className="db-supplier-table__col-select">
                          <input
                            type="radio"
                            name="supplier"
                            checked={selected}
                            onChange={() => dispatch(setSelectedSupplierId(id))}
                            aria-label={`Seleccionar ${name || 'proveedor'}`}
                          />
                        </td>
                        <td>{name || '—'}</td>
                        <td>{formatRutDisplay(rut)}</td>
                        <td>
                          <SupplierTypeChip supplierType={s.supplier_type} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>

      <section className={`db-card ${!stage1Ok ? 'db-card--locked' : ''}`}>
        <h2 className="db-card__title">2. Selección de cliente (opcional)</h2>
        <p className="db-card__hint">
          Seleccione la marca o cliente de la campaña. Puede continuar sin cliente si el contrato no lo requiere.
        </p>
        {!stage1Ok ? <p className="db-muted">Complete el paso anterior para habilitar esta sección.</p> : null}
        {stage1Ok && !canReadClients ? (
          <div className="clause-error">No tiene permiso para listar clientes.</div>
        ) : null}
        {stage1Ok && canReadClients && loadingClients ? <div className="db-muted">Cargando…</div> : null}
        {stage1Ok && canReadClients && !loadingClients ? (
          <>
            {clients.length === 0 ? (
              <p className="db-muted">No hay clientes registrados. Puede continuar sin seleccionar uno.</p>
            ) : (
              <div className="clause-list-table-wrap db-supplier-table-wrap">
                <table className="clause-list-table db-supplier-table" role="radiogroup" aria-label="Clientes">
                  <thead>
                    <tr>
                      <th className="db-supplier-table__col-select">
                        <span className="db-supplier-table-sr-only">Seleccionar</span>
                      </th>
                      <th>Nombre</th>
                      <th>Marca</th>
                      <th>Cuenta marca</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      className={`db-supplier-table__row${!selectedClientId ? ' db-supplier-table__row--selected' : ''}`}
                      onClick={() => dispatch(setSelectedClientId(null))}
                    >
                      <td className="db-supplier-table__col-select">
                        <input
                          type="radio"
                          name="client"
                          checked={!selectedClientId}
                          onChange={() => dispatch(setSelectedClientId(null))}
                          aria-label="Sin cliente"
                        />
                      </td>
                      <td colSpan={3}>
                        <em>Sin cliente</em>
                      </td>
                    </tr>
                    {clients.map((c) => {
                      const id = String(c.id)
                      const selected = selectedClientId === id
                      return (
                        <tr
                          key={id}
                          className={`db-supplier-table__row${selected ? ' db-supplier-table__row--selected' : ''}`}
                          onClick={() => dispatch(setSelectedClientId(id))}
                        >
                          <td className="db-supplier-table__col-select">
                            <input
                              type="radio"
                              name="client"
                              checked={selected}
                              onChange={() => dispatch(setSelectedClientId(id))}
                              aria-label={`Seleccionar ${c.name || 'cliente'}`}
                            />
                          </td>
                          <td>{c.name || '—'}</td>
                          <td>{c.brand || '—'}</td>
                          <td>{c.brand_account || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {selectedClient ? (
              <p className="db-muted" style={{ marginTop: '8px' }}>
                Cliente seleccionado: {selectedClient.name} ({selectedClient.brand})
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section
        className={`db-card ${!stage1Ok ? 'db-card--locked' : ''} ${stageTemplateOk ? 'db-card--done' : ''}`}
      >
        <h2 className="db-card__title">3. Selección de plantilla</h2>
        <p className="db-card__hint">Elija una plantilla estándar.</p>
        {!stage1Ok ? <p className="db-muted">Complete el paso anterior para habilitar esta sección.</p> : null}
        {stage1Ok && loadingTemplates ? <div className="db-muted">Cargando plantillas…</div> : null}
        {stage1Ok && !loadingTemplates ? (
          <div className="db-section">
            <div className="db-section__box" role="group" aria-label="Templates estándar">
              <div className="db-section__title">Templates estándar</div>
              <div className="db-list">
                {templates.map((t) => {
                  if (!t || t.kind !== 'standard') return null
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
        ) : null}
        {stage1Ok ? (
          <div className="db-actions db-actions--stacked">
            <div className="db-selected-template" aria-label="Plantilla seleccionada">
              <div className="db-selected-template__label">Plantilla seleccionada</div>
              <div className="db-selected-template__value">{selectedTemplateName || '—'}</div>
            </div>
            <button
              type="button"
              className="btn"
              disabled={!stageTemplateOk}
              onClick={() => navigate('/app/gestion-contratos/constructor-documento/preview')}
            >
              Ver preview
            </button>
          </div>
        ) : null}
      </section>

      <section
        className={`db-card ${!stageTemplateOk ? 'db-card--locked' : ''} ${stageGeneratedOk ? 'db-card--done' : ''}`}
      >
        <h2 className="db-card__title">4. Generación del documento (PDF)</h2>
        {!stageTemplateOk ? <p className="db-muted">Complete los pasos anteriores para habilitar esta sección.</p> : null}
        {stageTemplateOk && dryRunStatus === 'loading' ? (
          <p className="db-muted">Validando variables de la plantilla…</p>
        ) : null}
        {stageTemplateOk && dryRunStatus === 'ready' ? (
          <p className="db-muted">Plantilla lista para generar.</p>
        ) : null}
        {stageTemplateOk && dryRunStatus === 'needs_fields' && missingFieldDefs.length > 0 ? (
          <div className="db-missing">
            <p className="db-card__hint">Información adicional requerida:</p>
            {missingFieldDefs.map((field) => (
              <label key={field.key} className="db-field" htmlFor={`missing-field-${field.key}`}>
                <span>{field.label || field.key}</span>
                <MissingFieldInput
                  field={field}
                  value={missingFields[field.key] ?? ''}
                  overrides={missingFields}
                  onChange={(next) => {
                    if (typeof next === 'object' && next !== null) {
                      for (const [key, val] of Object.entries(next)) {
                        dispatch(setMissingField({ key, value: val }))
                      }
                    } else {
                      dispatch(setMissingField({ key: field.key, value: next }))
                    }
                  }}
                />
              </label>
            ))}
          </div>
        ) : null}
        {stageTemplateOk ? (
          <div className="db-actions">
            <button
              type="button"
              className="btn"
              disabled={!canGenerate || generating}
              onClick={() => void runGenerate()}
            >
              {generating ? 'Generando…' : 'Generar PDF y guardar'}
            </button>
          </div>
        ) : null}
      </section>

      <section className={`db-card ${!stageGeneratedOk ? 'db-card--locked' : ''}`}>
        <h2 className="db-card__title">5. Descarga (opcional)</h2>
        {!stageGeneratedOk ? (
          <p className="db-muted">
            Complete la generación en el paso anterior. El documento quedará guardado automáticamente; aquí
            podrá descargarlo cuando lo necesite.
          </p>
        ) : (
          <>
            <p className="db-card__hint">El documento ya está guardado. Descárguelo si lo necesita en su equipo.</p>
            <ul className="db-doc-list">
            {generatedDocuments.map((d) => (
              <li key={d.id} className="db-doc-row">
                <span className="db-doc-name">{d.file_name}</span>
                <button type="button" className="btn" onClick={() => void onDownload(d)}>
                  Descargar
                </button>
                {downloadErrors[d.id] ? <span className="clause-error">{downloadErrors[d.id]}</span> : null}
              </li>
            ))}
            </ul>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(duplicateDraft)}
        title="Contrato duplicado"
        message={duplicateDraft ? buildDuplicateDraftMessage(duplicateDraft) : null}
        confirmText="Reemplazar"
        cancelText="Cancelar"
        destructive
        onConfirm={() => void onConfirmReplaceDuplicate()}
        onCancel={onCancelDuplicateDialog}
      />
    </PageShell>
  )
}

export { draftStatusLabel, formatDraftCreatedAt, buildDuplicateDraftMessage }
