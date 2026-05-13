import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { signOutThunk } from '../store/authSlice'
import defaultAvatarUrl from '../assets/images/user-avatar-default.svg'

export function MainHeader() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function onSalir() {
    setMenuOpen(false)
    try {
      await dispatch(signOutThunk()).unwrap()
      navigate('/login', { replace: true })
    } catch {
      // Sesión no cerrada en servidor; no redirigir
    }
  }

  function onMiPerfil() {
    setMenuOpen(false)
    navigate('/app/mi-perfil')
  }

  // Cuando exista foto de perfil, usar `photoUrl ?? defaultAvatarUrl`
  const avatarSrc = defaultAvatarUrl

  return (
    <header className="main-header" role="banner">
      <div className="main-header__identity">
        <span className="app-icon" aria-hidden="true">
          GCC
        </span>
        <span className="main-header__title">
          Sistema de Gestión de Contratos
        </span>
      </div>
      <div className="main-header__actions">
        <Link className="main-header__link" to="/app/notificaciones">
          Notificaciones
        </Link>
        <div className="main-header__user-menu" ref={wrapRef}>
          <button
            id="userMenuTrigger"
            type="button"
            className="user-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menú de usuario"
          >
            <span className="user-avatar" aria-hidden="true">
              <img
                className="user-avatar__img"
                src={avatarSrc}
                alt=""
                decoding="async"
              />
            </span>
          </button>
          {menuOpen ? (
            <div className="user-dropdown" role="menu">
              <button type="button" className="user-dropdown__item" role="menuitem" onClick={onMiPerfil}>
                Mi perfil
              </button>
              <div className="user-dropdown__divider" role="separator" aria-hidden="true" />
              <button type="button" className="user-dropdown__item" role="menuitem" onClick={onSalir}>
                Salir
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
