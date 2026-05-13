import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { supabase } from '../auth/supabaseClient'
import { mapAuthErrorToSpanish } from '../auth/mapAuthErrorToSpanish'
import { sessionUpdated } from '../store/authSlice'
import './LoginPage.css'

function validatePassword(pw, confirm) {
  if (!pw || pw.trim().length === 0) return 'La contraseña no puede estar vacía.'
  if (pw.trim().length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (pw !== confirm) return 'La confirmación no coincide.'
  return null
}

export function ResetPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      // Supabase sets a temporary session when the recovery link is valid.
      if (!data?.session) {
        setHasRecoverySession(false)
        setError('El enlace de recuperación no es válido o expiró. Solicite uno nuevo.')
      } else {
        setHasRecoverySession(true)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    if (!hasRecoverySession) {
      setError('El enlace de recuperación no es válido o expiró. Solicite uno nuevo.')
      return
    }
    const validation = validatePassword(password, confirm)
    if (validation) {
      setError(validation)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: supabaseError } = await supabase.auth.updateUser({ password })
      if (supabaseError) {
        setError(mapAuthErrorToSpanish(supabaseError))
        return
      }
      // Clean up client session state and return to login.
      dispatch(sessionUpdated(null))
      try {
        await supabase.auth.signOut()
      } catch {
        // best-effort
      }
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 800)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">Restablecer contraseña</h1>
        <p className="login-page__intro">Defina una nueva contraseña para su cuenta.</p>

        {!ready ? <p className="login-page__message">Preparando recuperación…</p> : null}

        {done ? (
          <>
            <p className="login-page__message">Contraseña actualizada correctamente. Redirigiendo a iniciar sesión…</p>
            <div className="login-page__actions">
              <Link className="login-page__link" to="/login">
                Ir a iniciar sesión
              </Link>
            </div>
          </>
        ) : (
          <>
            {ready && !hasRecoverySession ? (
              <div className="login-page__actions" style={{ marginBottom: '10px' }}>
                <Link className="btn login-page__submit" to="/forgot-password">
                  Solicitar un nuevo enlace
                </Link>
                <Link className="login-page__link" to="/login">
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : null}

            <form className="login-page__form" onSubmit={onSubmit} noValidate>
            <div className="login-page__field">
              <label className="login-page__label" htmlFor="reset-password">
                Nueva contraseña
              </label>
              <input
                id="reset-password"
                className="login-page__input"
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  if (error) setError(null)
                  setPassword(e.target.value)
                }}
                disabled={submitting}
                required
              />
            </div>

            <div className="login-page__field">
              <label className="login-page__label" htmlFor="reset-confirm">
                Confirmación
              </label>
              <input
                id="reset-confirm"
                className="login-page__input"
                type="password"
                name="confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  if (error) setError(null)
                  setConfirm(e.target.value)
                }}
                disabled={submitting}
                required
              />
            </div>

            {error ? <p className="login-page__error">{error}</p> : null}

            <div className="login-page__actions">
              <button
                type="submit"
                className="btn login-page__submit"
                disabled={submitting || !ready || !hasRecoverySession}
              >
                {submitting ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
              <Link className="login-page__link" to="/login">
                Volver a iniciar sesión
              </Link>
            </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

