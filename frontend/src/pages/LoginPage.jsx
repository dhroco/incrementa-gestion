import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  clearSignInError,
  selectAuthGlobalMessage,
  selectSignInError,
  selectSignInSubmitting,
  signInWithPasswordThunk
} from '../store/authSlice'
import './LoginPage.css'

export function LoginPage() {
  const dispatch = useDispatch()
  const globalMessage = useSelector(selectAuthGlobalMessage)
  const signInError = useSelector(selectSignInError)
  const signInSubmitting = useSelector(selectSignInSubmitting)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    dispatch(signInWithPasswordThunk({ email: email.trim(), password }))
  }

  function onEmailChange(e) {
    if (signInError) dispatch(clearSignInError())
    setEmail(e.target.value)
  }

  function onPasswordChange(e) {
    if (signInError) dispatch(clearSignInError())
    setPassword(e.target.value)
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">Iniciar sesión</h1>
        <p className="login-page__intro">
          Ingrese su correo y contraseña para acceder al sistema.
        </p>
        <form className="login-page__form" onSubmit={onSubmit} noValidate>
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="login-email">
              Correo
            </label>
            <input
              id="login-email"
              className="login-page__input"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={onEmailChange}
              disabled={signInSubmitting}
              required
            />
          </div>
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="login-password">
              Contraseña
            </label>
            <input
              id="login-password"
              className="login-page__input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={onPasswordChange}
              disabled={signInSubmitting}
              required
            />
          </div>
          {globalMessage ? <p className="login-page__message">{globalMessage}</p> : null}
          {signInError ? <p className="login-page__error">{signInError}</p> : null}
          <div className="login-page__actions">
            <button type="submit" className="btn login-page__submit" disabled={signInSubmitting}>
              {signInSubmitting ? 'Ingresando…' : 'Ingresar'}
            </button>
            <Link className="login-page__link" to="/forgot-password">
              Olvidé mi contraseña
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

