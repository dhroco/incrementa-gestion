import '../placeholder/placeholder.css'
import { Link } from 'react-router-dom'

export function LoadingBlock({ title = 'Cargando…', subtitle = 'Espere un momento.' }) {
  return (
    <div className="ph-panel" role="status" aria-live="polite">
      <div className="ph-panel__title">{title}</div>
      <div style={{ opacity: 0.85 }}>{subtitle}</div>
    </div>
  )
}

export function ErrorBlock({ title = 'No se pudo cargar', message, onRetry }) {
  return (
    <div className="ph-panel" role="alert">
      <div className="ph-panel__title">{title}</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ opacity: 0.9 }}>{message || 'Ocurrió un error inesperado.'}</div>
        {typeof onRetry === 'function' ? (
          <button type="button" className="btn" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function EmptyBlock({
  title = 'Sin datos',
  message = 'No hay información para mostrar.',
  actionLabel,
  onAction
}) {
  return (
    <div className="ph-panel" role="status" aria-live="polite">
      <div className="ph-panel__title">{title}</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ opacity: 0.9 }}>{message}</div>
        {typeof onAction === 'function' && typeof actionLabel === 'string' && actionLabel.trim().length ? (
          <button type="button" className="btn" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function AccessDeniedBlock({
  title = 'Acceso denegado',
  message = 'No tiene permisos para acceder a esta sección.',
  to,
  linkLabel = 'Ir a una sección permitida'
}) {
  return (
    <div className="ph-panel" role="alert" aria-live="polite">
      <div className="ph-panel__title">{title}</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ opacity: 0.9 }}>{message}</div>
        {typeof to === 'string' && to.trim().length ? (
          <Link className="btn" to={to} replace>
            {linkLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export function UnderConstructionBlock({
  message = 'Esta funcionalidad se encuentra en construcción.'
}) {
  return (
    <div className="ph-under-construction" role="note" aria-label="Funcionalidad en construcción">
      {message}
    </div>
  )
}

