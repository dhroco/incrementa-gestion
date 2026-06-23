import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import { selectAvatarUrl, signOutThunk } from '../store/authSlice'
import { DEFAULT_PRIVATE_PATH } from '../navigation/menuConfig'
import defaultAvatarUrl from '../assets/images/user-avatar-default.svg'
import logoUrl from '../assets/images/logo_incrementa.png'

export function MainHeader() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const avatarUrl = useSelector(selectAvatarUrl)
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

  const avatarSrc = avatarUrl ?? defaultAvatarUrl
  const hasCustomAvatar = Boolean(avatarUrl)
  return (
    <header className="main-header" role="banner">
      <Link to={DEFAULT_PRIVATE_PATH} className="main-header__identity main-header__identity-link">
        <img className="main-header__logo" src={logoUrl} alt="Incrementa" />
        <span className="main-header__separator" aria-hidden="true" />
        <span className="main-header__title">Sistema de gestión back office</span>
      </Link>
      <div className="main-header__actions">
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
                className={`user-avatar__img${hasCustomAvatar ? ' user-avatar__img--photo' : ''}`}
                src={avatarSrc}
                alt=""
                decoding="async"
              />
            </span>
          </button>
          {menuOpen ? (
            <div className="user-dropdown" role="menu">
              <button type="button" className="user-dropdown__item" role="menuitem" onClick={onMiPerfil}>
                <span className="user-dropdown__item-icon" aria-hidden="true">
                  <PersonOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                </span>
                <span>Mi perfil</span>
              </button>
              <div className="user-dropdown__divider" role="separator" aria-hidden="true" />
              <button type="button" className="user-dropdown__item" role="menuitem" onClick={onSalir}>
                <span className="user-dropdown__item-icon" aria-hidden="true">
                  <LogoutOutlinedIcon sx={{ fontSize: 16 }} />
                </span>
                <span>Salir</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
