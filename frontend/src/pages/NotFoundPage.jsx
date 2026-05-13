import { Link } from 'react-router-dom'
import './LoginPage.css'
import { PageShell } from '../components/PageShell'

export function NotFoundPage({ mode = 'public' }) {
  const title = 'Página no encontrada'
  const message = 'La ruta solicitada no existe o no está disponible.'

  if (mode === 'private') {
    return (
      <PageShell title={title} subtitle={message}>
        <div className="ph-panel">
          <div className="ph-panel__title">¿Qué puede hacer?</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link className="btn" to="/app/dashboard">
              Ir al dashboard
            </Link>
            <Link className="btn" to="/login">
              Volver a login
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--color-work-area)',
        fontFamily: 'var(--font-family-base)',
        fontSize: '13px',
        color: 'var(--color-text-dark)'
      }}
    >
      <div className="login-page__card">
        <h1 className="login-page__title">{title}</h1>
        <p className="login-page__intro">{message}</p>
        <div className="login-page__actions">
          <Link className="btn login-page__submit" to="/login">
            Ir a login
          </Link>
        </div>
      </div>
    </div>
  )
}

