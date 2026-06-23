import { Link } from 'react-router-dom'
import './LoginPage.css'

const RECOVERY_MESSAGE =
  'Para recuperar tu contraseña, contacta al administrador de la plataforma.'

export function ForgotPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">Recuperar contraseña</h1>
        <p className="login-page__intro">{RECOVERY_MESSAGE}</p>
        <div className="login-page__actions">
          <Link className="login-page__link" to="/login">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
