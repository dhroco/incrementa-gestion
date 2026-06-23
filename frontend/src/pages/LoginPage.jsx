import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useMsal } from '@azure/msal-react'
import { API_SCOPE } from '../config/msalConfig'
import { selectAuthGlobalMessage } from '../store/authSlice'
import logoUrl from '../assets/images/logo_incrementa.png'
import './LoginPage.css'

export function LoginPage() {
  const { instance } = useMsal()
  const globalMessage = useSelector(selectAuthGlobalMessage)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function onContinueWithMicrosoft() {
    setSubmitting(true)
    setError(null)
    try {
      await instance.loginRedirect({ scopes: [API_SCOPE] })
    } catch {
      setSubmitting(false)
      setError('No se pudo iniciar sesión con Microsoft. Intente nuevamente.')
    }
  }

  return (
    <div className="login-page">
      <img className="login-page__logo" src={logoUrl} alt="Incrementa" />
      <div className="login-page__card">
        <h1 className="login-page__title">Sistema de gestión back office</h1>
        <div className="login-page__form">
          {globalMessage ? <p className="login-page__message">{globalMessage}</p> : null}
          {error ? <p className="login-page__error">{error}</p> : null}
          <div className="login-page__actions">
            <button
              type="button"
              className="btn login-page__submit"
              disabled={submitting}
              onClick={onContinueWithMicrosoft}
            >
              {submitting ? 'Redirigiendo…' : 'Continuar con Microsoft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
