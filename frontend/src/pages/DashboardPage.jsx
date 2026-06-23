import { useCallback, useEffect, useState } from 'react'
import { useAbility } from '@casl/react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { selectWidgetPreferences } from '../store/authSlice'
import { AbilityContext } from '../lib/ability'
import { fetchDashboardStats } from '../api/dashboardApi'
import { AccessDeniedBlock, ErrorBlock } from '../components/AsyncStateBlock'
import { PageShell } from '../components/PageShell'
import { DEFAULT_PRIVATE_PATH } from '../navigation/menuConfig'
import '../styles/dashboard.css'
import suppliersBgUrl from '../assets/images/dashboard-suppliers-bg.png'

const PLACEHOLDER_WIDGET_SLOTS = 7

function PlaceholderWidget({ index }) {
  return (
    <article
      className="dash-widget dash-widget--placeholder"
      aria-labelledby={`dash-placeholder-${index}-title`}
      aria-disabled="true"
    >
      <h2 id={`dash-placeholder-${index}-title`} className="dash-widget__title dash-widget__title--placeholder">
        Nuevo widget
      </h2>
    </article>
  )
}

function formatNumberCL(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-CL').format(value)
}

function SuppliersWidget({ stats, loading, canCreate }) {
  const total = stats?.suppliers?.total
  const personaNatural = stats?.suppliers?.personaNatural
  const empresa = stats?.suppliers?.empresa

  return (
    <article
      className="dash-widget dash-widget--suppliers"
      aria-labelledby="dash-suppliers-title"
      style={{ '--dash-suppliers-bg-url': `url(${suppliersBgUrl})` }}
    >
      <h2 id="dash-suppliers-title" className="dash-widget__title">
        Proveedores
      </h2>
      <div className={`dash-widget__metric${loading ? ' dash-widget__metric--loading' : ''}`}>
        {loading ? '—' : formatNumberCL(total)}
      </div>
      <p className="dash-widget__subtitle">Proveedores registrados en el sistema</p>
      {loading ? (
        <p className="dash-widget__loading">Cargando…</p>
      ) : (
        <p className="dash-widget__breakdown">
          {formatNumberCL(personaNatural)} personas naturales · {formatNumberCL(empresa)} empresas
        </p>
      )}
      <div className="dash-widget__actions">
        <Link to="/app/proveedores" className="dash-widget__btn dash-widget__btn--primary">
          Ver listado
        </Link>
        {canCreate ? (
          <Link to="/app/proveedores/nuevo" className="dash-widget__btn dash-widget__btn--secondary">
            Crear nuevo
          </Link>
        ) : null}
      </div>
    </article>
  )
}

function ContractsWidget({ stats, loading, canViewContracts }) {
  const draftPending = stats?.contracts?.draftPending
  const signedTotal = stats?.contracts?.signedTotal

  return (
    <article className="dash-widget dash-widget--contracts" aria-labelledby="dash-contracts-title">
      <div className="dash-contracts__panel">
        <h2 id="dash-contracts-title" className="dash-widget__title">
          Contratos
        </h2>
        {loading ? (
          <p className="dash-contracts__stats dash-contracts__stats--loading">Cargando…</p>
        ) : (
          <p className="dash-contracts__stats">
            <span className="dash-contracts__stat">
              <span className="dash-contracts__stat-value">{formatNumberCL(draftPending)}</span>
              <span className="dash-contracts__stat-label">borradores</span>
            </span>
            <span className="dash-contracts__stat-sep" aria-hidden="true">
              ·
            </span>
            <span className="dash-contracts__stat">
              <span className="dash-contracts__stat-value">{formatNumberCL(signedTotal)}</span>
              <span className="dash-contracts__stat-label">firmados</span>
            </span>
          </p>
        )}
        <div className="dash-widget__actions dash-contracts__actions">
          <Link
            to="/app/gestion-contratos/constructor-documento"
            className="dash-widget__btn dash-widget__btn--primary"
          >
            Constructor
          </Link>
          {canViewContracts ? (
            <Link
              to="/app/gestion-contratos/consulta-contratos"
              className="dash-widget__btn dash-widget__btn--secondary"
            >
              Ver contratos
            </Link>
          ) : (
            <span className="dash-widget__btn dash-widget__btn--secondary dash-widget__btn--disabled" aria-disabled="true">
              Ver contratos
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function TemplatesWidget({ stats, loading, canCreate }) {
  const activeTotal = stats?.templates?.activeTotal
  const mostRecentName = stats?.templates?.mostRecentName

  return (
    <article className="dash-widget dash-widget--templates" aria-labelledby="dash-templates-title">
      <h2 id="dash-templates-title" className="dash-widget__title">
        Plantillas
      </h2>
      <div className={`dash-widget__metric${loading ? ' dash-widget__metric--loading' : ''}`}>
        {loading ? '—' : formatNumberCL(activeTotal)}
      </div>
      <p className="dash-widget__subtitle">Plantillas activas</p>
      {loading ? (
        <p className="dash-widget__loading">Cargando…</p>
      ) : (
        <p className="dash-widget__breakdown">
          Más reciente: {typeof mostRecentName === 'string' && mostRecentName.trim() ? mostRecentName : '—'}
        </p>
      )}
      <div className="dash-widget__actions">
        <Link
          to="/app/gestion-contratos/templates-estandar"
          className="dash-widget__btn dash-widget__btn--primary"
        >
          Ver listado
        </Link>
        {canCreate ? (
          <Link
            to="/app/gestion-contratos/templates-estandar/nueva"
            className="dash-widget__btn dash-widget__btn--secondary"
          >
            Crear nueva
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export function DashboardPage() {
  const widgetPreferences = useSelector(selectWidgetPreferences)
  const ability = useAbility(AbilityContext)
  const defaultPath = DEFAULT_PRIVATE_PATH

  const prefs = widgetPreferences ?? { suppliers: true, contracts: true, templates: true }
  const showSuppliers = prefs.suppliers !== false && ability.can('read', 'Supplier')
  const showContracts = prefs.contracts !== false && ability.can('use', 'DocumentBuilder')
  const showTemplates = prefs.templates !== false && ability.can('read', 'Template')
  const canViewContracts = ability.can('read', 'Contract')
  const canCreateSupplier = ability.can('create', 'Supplier')
  const canCreateTemplate = ability.can('create', 'Template')
  const hasAnyWidget = showSuppliers || showContracts || showTemplates

  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState(null)
  const [stats, setStats] = useState(null)

  const load = useCallback(async () => {
    if (!hasAnyWidget) {
      setStatus('success')
      setStats(null)
      setErrorMessage(null)
      return
    }

    setStatus('loading')
    setErrorMessage(null)

    const res = await fetchDashboardStats({})
    if (!res.ok) {
      if (res.kind === 'forbidden') {
        setStatus('denied')
        return
      }
      setStatus('error')
      setErrorMessage(res.message)
      return
    }

    setStats(res.data && typeof res.data === 'object' ? res.data : null)
    setStatus('success')
  }, [hasAnyWidget])

  useEffect(() => {
    load()
  }, [load])

  const loading = status === 'loading'
  const showGrid = status === 'loading' || status === 'success'

  return (
    <PageShell hideHeader>
      {status === 'error' ? <ErrorBlock message={errorMessage} onRetry={load} /> : null}

      {status === 'denied' ? <AccessDeniedBlock to={defaultPath} /> : null}

      {showGrid ? (
        <div className="dash-grid">
          {showSuppliers ? (
            <SuppliersWidget stats={stats} loading={loading} canCreate={canCreateSupplier} />
          ) : null}
          {showContracts ? (
            <ContractsWidget stats={stats} loading={loading} canViewContracts={canViewContracts} />
          ) : null}
          {showTemplates ? (
            <TemplatesWidget stats={stats} loading={loading} canCreate={canCreateTemplate} />
          ) : null}
          {Array.from({ length: PLACEHOLDER_WIDGET_SLOTS }, (_, index) => (
            <PlaceholderWidget key={`placeholder-${index + 1}`} index={index + 1} />
          ))}
        </div>
      ) : null}
    </PageShell>
  )
}
