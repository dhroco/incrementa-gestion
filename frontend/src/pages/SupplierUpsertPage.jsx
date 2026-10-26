import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createSupplier, fetchIdentityDocumentTypes, fetchSupplierDetail, updateSupplier } from '../api/suppliersApi'
import { AbilityContext } from '../lib/ability'
import {
  SupplierBasicDataSection,
  SupplierSocialNetworksSection,
  buildSupplierFormPayload,
  emptySupplierForm,
  getFirstSupplierFormTabWithErrors,
  supplierToForm
} from './SupplierFormSections'
import { SupplierDocumentHistoryPanel } from './SupplierDocumentHistoryPanel'
import '../styles/shared-form.css'

const SUPPLIER_TABS = [
  { id: 'datos_basicos', label: 'Datos básicos' },
  { id: 'redes_sociales', label: 'Redes sociales' },
  { id: 'antecedentes', label: 'Antecedentes contractuales' }
]

export function SupplierCreatePage() {
  return <SupplierUpsertContent mode="create" />
}

export function SupplierEditPage() {
  return <SupplierUpsertContent mode="edit" />
}

function SupplierUpsertContent({ mode }) {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)
  const can =
    mode === 'create'
      ? ability.can('create', 'Supplier')
      : ability.can('update', 'Supplier') || ability.can('create', 'Supplier')

  const [form, setForm] = useState(emptySupplierForm)
  const [identityDocumentTypes, setIdentityDocumentTypes] = useState([])
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [activeTab, setActiveTab] = useState('datos_basicos')

  const setF = useCallback((k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((fe) => {
      if (!fe[k]) return fe
      const next = { ...fe }
      delete next[k]
      return next
    })
    setError(null)
  }, [])

  function failValidation(fe) {
    setFieldErrors(fe)
    const tab = getFirstSupplierFormTabWithErrors(fe)
    if (tab && mode === 'edit') setActiveTab(tab)
    const firstMessage =
      fe.first_names ||
      fe.last_name ||
      fe.rep_first_names ||
      fe.rep_last_name ||
      fe.country_code ||
      fe.rut ||
      fe.email ||
      fe.phone ||
      fe.razon_social ||
      fe.rut_empresa ||
      fe.rut_rep_legal ||
      fe.social_networks ||
      'Revise los campos del formulario.'
    setError(firstMessage)
    scrollToFirstFieldError()
    return null
  }

  function scrollToFirstFieldError() {
    requestAnimationFrame(() => {
      document.querySelector('.clause-field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  useEffect(() => {
    let active = true
    async function loadCatalog() {
      const res = await fetchIdentityDocumentTypes()
      if (!active) return
      if (res.ok) setIdentityDocumentTypes(res.data?.items || [])
    }
    loadCatalog()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !routeId) return
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const res = await fetchSupplierDetail({ id: routeId })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el proveedor.')
        return
      }
      const s = res.data?.supplier
      if (s) setForm(supplierToForm(s))
    }
    load()
    return () => {
      active = false
    }
  }, [mode, routeId])

  const listHref = '/app/proveedores'
  const breadcrumb = useMemo(() => {
    if (mode === 'create') return [{ label: 'Proveedores', to: listHref }, { label: 'Nuevo proveedor' }]
    return [{ label: 'Proveedores', to: listHref }, { label: 'Editar' }]
  }, [listHref, mode])

  const subActions = useMemo(
    () => (
      <button type="submit" form="supplier-upsert-form" className="btn" disabled={saving || loading || !can}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [can, loading, saving]
  )

  const onSocialNetworksChange = useCallback((networks) => {
    setForm((f) => ({ ...f, social_networks: networks }))
    setFieldErrors((fe) => {
      if (!fe.social_networks) return fe
      const { social_networks, ...rest } = fe
      return rest
    })
    setError(null)
  }, [])

  const sectionProps = {
    form,
    onChange: setF,
    typeLocked: mode === 'edit',
    fieldErrors,
    onSocialNetworksChange,
    emailRequired: mode === 'create',
    identityDocumentTypes
  }

  function buildPayload() {
    const built = buildSupplierFormPayload(form, {
      emailRequired: mode === 'create',
      identityDocumentTypes
    })
    if (!built.ok) return failValidation(built.fieldErrors)
    return built.payload
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!can) return
    const p = buildPayload()
    if (!p) return
    setFieldErrors({})
    setSaving(true)
    try {
      if (mode === 'create') {
        const res = await createSupplier(p, {})
        if (!res.ok) {
          setError(res.message ?? 'No se pudo crear el proveedor.')
          return
        }
        const newId = res.data?.supplier?.id
        navigate(newId ? `/app/proveedores/${newId}` : listHref, { replace: true })
      } else {
        const res = await updateSupplier(routeId, p, {})
        if (!res.ok) {
          setError(res.message ?? 'No se pudo actualizar el proveedor.')
          return
        }
        navigate(`/app/proveedores/${routeId}`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const formBody =
    loading ? (
      <div className="clause-list-loading">Cargando…</div>
    ) : mode === 'create' ? (
      <div className="company-form-page-stack">
        <div className="ph-card clause-card company-form-block-card">
          <h2 className="company-form-block-title">Datos básicos del proveedor</h2>
          <div className="clause-form">
            <SupplierBasicDataSection {...sectionProps} />
          </div>
        </div>
        <div className="ph-card clause-card company-form-block-card">
          <h2 className="company-form-block-title">Redes sociales</h2>
          <div className="clause-form">
            <SupplierSocialNetworksSection {...sectionProps} />
          </div>
        </div>
      </div>
    ) : (
      <div className="company-form-tabs-layout">
        <div className="clause-form">
          <div className="company-shell-tabs">
            <div className="company-shell-tabs-bar" role="tablist" aria-label="Secciones proveedor">
              {SUPPLIER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className="company-shell-tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="company-shell-tabs-panel">
              {activeTab === 'datos_basicos' ? (
                <div role="tabpanel">
                  <SupplierBasicDataSection {...sectionProps} />
                </div>
              ) : null}
              {activeTab === 'redes_sociales' ? (
                <div role="tabpanel">
                  <SupplierSocialNetworksSection {...sectionProps} />
                </div>
              ) : null}
              {activeTab === 'antecedentes' ? (
                <div role="tabpanel">
                  <SupplierDocumentHistoryPanel supplierId={routeId} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )

  if (!can) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="ph-card clause-card">
          <div className="clause-error">No tiene permiso para {mode === 'create' ? 'crear' : 'editar'} proveedores.</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      {error ? (
        <div className="ph-card clause-card" style={{ marginBottom: '12px' }}>
          <div className="clause-form">
            <div className="clause-error">{error}</div>
          </div>
        </div>
      ) : null}
      <form id="supplier-upsert-form" onSubmit={onSubmit} noValidate>
        {formBody}
      </form>
    </PageShell>
  )
}
