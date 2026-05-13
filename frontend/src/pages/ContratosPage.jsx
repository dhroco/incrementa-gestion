import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { apiGet } from '../api/apiClient'
import { PlaceholderTable } from '../placeholder/PlaceholderTable'
import { AccessDeniedBlock, EmptyBlock, ErrorBlock, LoadingBlock, UnderConstructionBlock } from '../components/AsyncStateBlock'
import { PageShell } from '../components/PageShell'
import { getDefaultPrivatePathFromRoutes } from '../navigation/authorizationSelectors'

function formatCLP(value) {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(value)
}

export function ContratosPage({
  title = 'Contratos',
  subtitle = 'Bandeja de contratos. Próximamente podrá crear y gestionar contratos.',
  emptyTitle = 'Sin contratos',
  emptyMessage = 'No hay contratos para mostrar en este momento.'
}) {
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const navigation = useSelector(selectEnrichedNavigation)
  const defaultPath = getDefaultPrivatePathFromRoutes(navigation?.routes) || '/app/dashboard'

  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState(null)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(null)

  const columns = useMemo(
    () => ['Código', 'Título', 'Proveedor', 'Estado', 'Inicio', 'Término', 'Monto'],
    []
  )

  const load = useCallback(async () => {
    if (!accessToken) {
      setStatus('error')
      setErrorMessage('No autorizado. Inicie sesión nuevamente.')
      return
    }
    setStatus('loading')
    setErrorMessage(null)

    const res = await apiGet('/api/placeholder/contratos/list', { accessToken })
    if (!res.ok) {
      if (res.kind === 'forbidden') {
        setStatus('denied')
        return
      }
      setStatus('error')
      setErrorMessage(res.message)
      return
    }

    const d = res.data && typeof res.data === 'object' ? res.data : null
    const nextItems = Array.isArray(d?.items) ? d.items : []
    const nextTotal = res.meta && typeof res.meta === 'object' ? res.meta.total : null

    setTotal(typeof nextTotal === 'number' ? nextTotal : null)
    setItems(
      nextItems.map((it) => ({
        Código: typeof it?.code === 'string' ? it.code : '—',
        Título: typeof it?.title === 'string' ? it.title : '—',
        Proveedor: typeof it?.provider === 'string' ? it.provider : '—',
        Estado: typeof it?.status === 'string' ? it.status : '—',
        Inicio: typeof it?.startDate === 'string' ? it.startDate : '—',
        Término: typeof it?.endDate === 'string' ? it.endDate : '—',
        Monto: formatCLP(typeof it?.amountCLP === 'number' ? it.amountCLP : NaN)
      }))
    )

    setStatus('success')
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
    >
      <UnderConstructionBlock />

      {status === 'loading' ? (
        <LoadingBlock title="Cargando contratos…" subtitle="Obteniendo listado desde el servidor." />
      ) : null}

      {status === 'error' ? <ErrorBlock message={errorMessage} onRetry={load} /> : null}

      {status === 'denied' ? <AccessDeniedBlock to={defaultPath} /> : null}

      {status === 'success' ? (
        items.length === 0 ? (
          <EmptyBlock title={emptyTitle} message={emptyMessage} />
        ) : (
          <PlaceholderTable
            title={typeof total === 'number' ? `Listado (${total})` : 'Listado'}
            columns={columns}
            rows={items}
          />
        )
      ) : null}
    </PageShell>
  )
}

