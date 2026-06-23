import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchSupplierDetail } from '../api/suppliersApi'
import { AbilityContext } from '../lib/ability'
import {
  SupplierBasicDataSection,
  SupplierSocialNetworksSection,
  supplierToForm
} from './SupplierFormSections'
import { SupplierDocumentHistoryPanel } from './SupplierDocumentHistoryPanel'
import '../styles/shared-form.css'

const SUPPLIER_TABS = [
  { id: 'datos_basicos', label: 'Datos básicos' },
  { id: 'redes_sociales', label: 'Redes sociales' },
  { id: 'antecedentes', label: 'Antecedentes contractuales' }
]

export function SupplierViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)
  const canRead = ability.can('read', 'Supplier')
  const canEdit = ability.can('update', 'Supplier') || ability.can('create', 'Supplier')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [supplier, setSupplier] = useState(null)
  const [form, setForm] = useState(null)
  const [activeTab, setActiveTab] = useState('datos_basicos')

  useEffect(() => {
    let active = true
    async function load() {
      if (!id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchSupplierDetail({ id })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el proveedor.')
        setSupplier(null)
        setForm(null)
        return
      }
      const s = res.data?.supplier
      setSupplier(s || null)
      setForm(s ? supplierToForm(s) : null)
    }
    load()
    return () => {
      active = false
    }
  }, [id])

  const listPath = '/app/proveedores'
  const breadcrumb = useMemo(
    () => (canRead ? [{ label: 'Proveedores', to: listPath }, { label: 'Detalle' }] : null),
    [canRead, listPath]
  )

  const subActions = useMemo(() => {
    const actions = [
      <button key="back" type="button" className="btn" onClick={() => navigate(listPath)}>
        Volver
      </button>
    ]
    if (supplier && canEdit && id) {
      actions.push(
        <button
          key="edit"
          type="button"
          className="btn"
          onClick={() => navigate(`/app/proveedores/${id}/edit`)}
        >
          Editar
        </button>
      )
    }
    return actions
  }, [canEdit, id, listPath, navigate, supplier])

  if (!canRead) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="ph-card clause-card">
          <div className="clause-error">No tiene permiso para ver este proveedor.</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      {loading ? <div className="clause-list-loading">Cargando…</div> : null}
      {error ? (
        <div className="ph-card clause-card">
          <div className="clause-error">{error}</div>
        </div>
      ) : null}
      {!loading && form ? (
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
                    <SupplierBasicDataSection form={form} onChange={() => {}} readOnly typeLocked />
                  </div>
                ) : null}
                {activeTab === 'redes_sociales' ? (
                  <div role="tabpanel">
                    <SupplierSocialNetworksSection form={form} readOnly />
                  </div>
                ) : null}
                {activeTab === 'antecedentes' ? (
                  <div role="tabpanel">
                    <SupplierDocumentHistoryPanel supplierId={id} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
