import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchClientById } from '../api/clientsApi'
import { AbilityContext } from '../lib/ability'
import { ClientFormPageStack, clientToForm } from './ClientFormSections'
import '../styles/shared-form.css'

const LIST_PATH = '/app/admin-global/clientes'

export function ClientViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)
  const canRead = ability.can('read', 'Client')
  const canEdit = ability.can('update', 'Client') || ability.can('create', 'Client')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchClientById(id, {})
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el cliente.')
        setForm(null)
        return
      }
      const c = res.data?.client
      setForm(c ? clientToForm(c) : null)
    }
    load()
    return () => {
      active = false
    }
  }, [id])

  const breadcrumb = useMemo(
    () => (canRead ? [{ label: 'Clientes', to: LIST_PATH }, { label: 'Detalle' }] : null),
    [canRead]
  )

  const subActions = useMemo(() => {
    const actions = [
      <button key="back" type="button" className="btn" onClick={() => navigate(LIST_PATH)}>
        Volver
      </button>
    ]
    if (form && canEdit && id) {
      actions.push(
        <button key="edit" type="button" className="btn" onClick={() => navigate(`${LIST_PATH}/${id}/edit`)}>
          Editar
        </button>
      )
    }
    return actions
  }, [canEdit, form, id, navigate])

  if (!canRead) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="ph-card clause-card">
          <div className="clause-error">No tiene permiso para ver este cliente.</div>
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
      {!loading && form ? <ClientFormPageStack form={form} readOnly /> : null}
    </PageShell>
  )
}
