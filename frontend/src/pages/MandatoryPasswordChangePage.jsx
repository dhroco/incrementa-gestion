import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../auth/supabaseClient'
import { fetchEnrichedSessionThunk, selectSession, sessionUpdated, signOutThunk } from '../store/authSlice'
import { postPasswordRotationComplete } from '../api/accountantsPlatformApi'
import { mapAuthErrorToSpanish } from '../auth/mapAuthErrorToSpanish'

export function MandatoryPasswordChangePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password })
      if (upErr) {
        setError(mapAuthErrorToSpanish(upErr))
        setSubmitting(false)
        return
      }
      const {
        data: { session: freshSession }
      } = await supabase.auth.getSession()
      if (freshSession) {
        dispatch(sessionUpdated(freshSession))
      }
      const token = freshSession?.access_token ?? accessToken
      const done = await postPasswordRotationComplete({ accessToken: token })
      if (!done.ok) {
        setError(done.message || 'No se pudo actualizar el estado de la cuenta.')
        setSubmitting(false)
        return
      }
      await dispatch(fetchEnrichedSessionThunk({ force: true }))
      setSubmitting(false)
      navigate('/app', { replace: true })
    } catch {
      setError('Ocurrió un error inesperado. Intente nuevamente.')
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: 'var(--color-work-area)',
        fontFamily: 'var(--font-family-base)',
        fontSize: '13px',
        color: 'var(--color-text-dark)',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#fff',
          border: '1px solid #E3E6E8',
          padding: '16px',
          textAlign: 'left'
        }}
      >
        <h1 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700 }}>Cambio de contraseña obligatorio</h1>
        <p style={{ margin: '0 0 12px', lineHeight: 1.4 }}>
          Por seguridad debe definir una nueva contraseña antes de continuar. Use una contraseña que no haya utilizado
          antes en otros sitios.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 600 }}>Nueva contraseña</span>
            <input
              className="clause-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 600 }}>Confirmar contraseña</span>
            <input
              className="clause-input"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(ev) => setPassword2(ev.target.value)}
              required
            />
          </label>
          {error ? <p style={{ margin: 0, color: '#a40000' }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <button type="button" className="btn" onClick={() => dispatch(signOutThunk())}>
              Salir
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
