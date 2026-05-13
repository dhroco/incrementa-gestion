export function AuthLoadingScreen() {
  return (
    <div
      className="auth-loading-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-work-area)',
        fontFamily: 'var(--font-family-base)',
        fontSize: '13px',
        color: 'var(--color-text-dark)'
      }}
    >
      Cargando…
    </div>
  )
}
