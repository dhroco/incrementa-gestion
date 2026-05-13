import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../auth/supabaseClient'
import { mapAuthErrorToSpanish } from '../auth/mapAuthErrorToSpanish'
import './LoginPage.css'

function isValidEmail(v) {
  return typeof v === 'string' && v.includes('@') && v.trim().length >= 3
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const redirectTo = useMemo(() => {
    try {
      return `${window.location.origin}/reset-password`
    } catch {
      return '/reset-password'
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setError('Ingrese un correo válido.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      if (supabaseError) {
        const status = supabaseError.status ?? supabaseError.code
        if (status === 429) {
          setError('Demasiados intentos. Espere unos minutos e intente nuevamente.')
        } else {
          setError(mapAuthErrorToSpanish(supabaseError))
        }
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">Recuperar contraseña</h1>
        <p className="login-page__intro">
          Ingrese su correo. Si existe una cuenta, le enviaremos un enlace para restablecer su contraseña.
        </p>

        {done ? (
          <>
            <p className="login-page__message">
              Solicitud enviada. Si el correo está registrado, recibirá un enlace de recuperación en unos minutos.
            </p>
            <div className="login-page__actions">
              <Link className="login-page__link" to="/login">
                Volver a iniciar sesión
              </Link>
            </div>
          </>
        ) : (
          <form className="login-page__form" onSubmit={onSubmit} noValidate>
            <div className="login-page__field">
              <label className="login-page__label" htmlFor="forgot-email">
                Correo
              </label>
              <input
                id="forgot-email"
                className="login-page__input"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  if (error) setError(null)
                  setEmail(e.target.value)
                }}
                disabled={submitting}
                required
              />
            </div>

            {error ? <p className="login-page__error">{error}</p> : null}

            <div className="login-page__actions">
              <button type="submit" className="btn login-page__submit" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar enlace'}
              </button>
              <Link className="login-page__link" to="/login">
                Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

