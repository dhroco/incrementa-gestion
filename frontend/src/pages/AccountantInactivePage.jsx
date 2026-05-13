import { useDispatch } from 'react-redux'
import { signOutThunk } from '../store/authSlice'

export function AccountantInactivePage() {
  const dispatch = useDispatch()

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
        padding: '24px',
        textAlign: 'center'
      }}
    >
      <h1 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Usuario deshabilitado</h1>
      <p style={{ maxWidth: '440px', margin: 0 }}>
        Su usuario está deshabilitado. Contacte al administrador de la plataforma para reactivarlo.
      </p>
      <button type="button" className="btn" onClick={() => dispatch(signOutThunk())}>
        Salir
      </button>
    </div>
  )
}
