import { PlaceholderCardGrid } from '../placeholder/PlaceholderCardGrid'
import { PlaceholderTable } from '../placeholder/PlaceholderTable'
import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { apiGet } from '../api/apiClient'
import { AccessDeniedBlock, EmptyBlock, ErrorBlock, LoadingBlock, UnderConstructionBlock } from '../components/AsyncStateBlock'
import { PageShell } from '../components/PageShell'
import { getDefaultPrivatePathFromRoutes } from '../navigation/authorizationSelectors'

function formatNumberCL(value) {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat('es-CL').format(value)
}

export function DashboardPage() {
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const navigation = useSelector(selectEnrichedNavigation)
  const defaultPath = getDefaultPrivatePathFromRoutes(navigation?.routes) || '/app/dashboard'

  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState(null)
  const [cards, setCards] = useState([])
  const [activityRows, setActivityRows] = useState([])

  const load = useCallback(async () => {
    if (!accessToken) {
      setStatus('error')
      setErrorMessage('No autorizado. Inicie sesión nuevamente.')
      return
    }
    setStatus('loading')
    setErrorMessage(null)

    const res = await apiGet('/api/placeholder/dashboard', { accessToken })
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
    const nextCards = Array.isArray(d?.cards) ? d.cards : []
    const highlightItems = Array.isArray(d?.highlights?.items) ? d.highlights.items : []

    setCards(
      nextCards.map((c) => ({
        title: typeof c?.label === 'string' ? c.label : '—',
        value: formatNumberCL(typeof c?.value === 'number' ? c.value : NaN)
      }))
    )

    setActivityRows(
      highlightItems.map((it) => ({
        Fecha: typeof it?.date === 'string' ? it.date : '—',
        Evento: typeof it?.label === 'string' ? it.label : '—',
        Estado: typeof it?.status === 'string' ? it.status : '—'
      }))
    )

    setStatus('success')
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageShell
      title="Dashboard"
      subtitle="Resumen general del sistema. Próximamente verá indicadores y alertas basados en datos reales."
    >
      <UnderConstructionBlock />

      {status === 'loading' ? (
        <LoadingBlock title="Cargando dashboard…" subtitle="Obteniendo información desde el servidor." />
      ) : null}

      {status === 'error' ? <ErrorBlock message={errorMessage} onRetry={load} /> : null}

      {status === 'denied' ? <AccessDeniedBlock to={defaultPath} /> : null}

      {status === 'success' ? (
        cards.length === 0 && activityRows.length === 0 ? (
          <EmptyBlock title="Sin información" message="No hay datos para mostrar en este momento." />
        ) : (
          <>
            <PlaceholderCardGrid items={cards} />
            <PlaceholderTable
              title="Actividad reciente"
              columns={['Fecha', 'Evento', 'Estado']}
              rows={activityRows}
            />
          </>
        )
      ) : null}
    </PageShell>
  )
}
