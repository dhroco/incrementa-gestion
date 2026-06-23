import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createClient, fetchClientById, updateClient } from '../api/clientsApi'
import { AbilityContext } from '../lib/ability'
import {
  ClientFormPageStack,
  clientToForm,
  emptyClientForm,
  productCampaignsForSubmit
} from './ClientFormSections'
import '../styles/shared-form.css'

const LIST_PATH = '/app/admin-global/clientes'

export function ClientCreatePage() {
  return <ClientUpsertContent mode="create" />
}

export function ClientEditPage() {
  return <ClientUpsertContent mode="edit" />
}

function ClientUpsertContent({ mode }) {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)
  const can =
    mode === 'create'
      ? ability.can('create', 'Client')
      : ability.can('update', 'Client') || ability.can('create', 'Client')

  const [form, setForm] = useState(emptyClientForm)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

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

  const onProductCampaignsChange = useCallback((rows) => {
    setForm((f) => ({ ...f, product_campaigns: rows }))
    setFieldErrors((fe) => {
      if (!fe.product_campaigns) return fe
      const { product_campaigns, ...rest } = fe
      return rest
    })
    setError(null)
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !routeId) return
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const res = await fetchClientById(routeId, {})
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el cliente.')
        return
      }
      const c = res.data?.client
      if (c) setForm(clientToForm(c))
    }
    load()
    return () => {
      active = false
    }
  }, [mode, routeId])

  const breadcrumb = useMemo(() => {
    if (mode === 'create') {
      return [{ label: 'Clientes', to: LIST_PATH }, { label: 'Nuevo cliente' }]
    }
    return [{ label: 'Clientes', to: LIST_PATH }, { label: 'Editar' }]
  }, [mode])

  const subActions = useMemo(
    () => (
      <button type="submit" form="client-upsert-form" className="btn" disabled={saving || loading || !can}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [can, loading, saving]
  )

  function buildPayload() {
    const fe = {}
    if (!String(form.name || '').trim()) fe.name = 'El nombre es obligatorio.'
    if (!String(form.brand || '').trim()) fe.brand = 'La marca es obligatoria.'
    if (Object.keys(fe).length) {
      setFieldErrors(fe)
      setError(fe.name || fe.brand)
      return null
    }
    return {
      name: String(form.name).trim(),
      brand: String(form.brand).trim(),
      brand_account: String(form.brand_account || '').trim() || null,
      product_campaigns: productCampaignsForSubmit(form.product_campaigns)
    }
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
        const res = await createClient(p, {})
        if (!res.ok) {
          setError(res.message ?? 'No se pudo crear el cliente.')
          return
        }
        const newId = res.data?.client?.id
        navigate(newId ? `${LIST_PATH}/${newId}` : LIST_PATH, { replace: true })
      } else {
        const res = await updateClient(routeId, p, {})
        if (!res.ok) {
          setError(res.message ?? 'No se pudo actualizar el cliente.')
          return
        }
        navigate(`${LIST_PATH}/${routeId}`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!can) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="ph-card clause-card">
          <div className="clause-error">
            No tiene permiso para {mode === 'create' ? 'crear' : 'editar'} clientes.
          </div>
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
      <form id="client-upsert-form" onSubmit={onSubmit} noValidate>
        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <ClientFormPageStack
            form={form}
            onChange={setF}
            fieldErrors={fieldErrors}
            onProductCampaignsChange={onProductCampaignsChange}
          />
        )}
      </form>
    </PageShell>
  )
}
