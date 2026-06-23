import { Link, useLocation } from 'react-router-dom'
import { DEFAULT_PRIVATE_PATH } from '../navigation/menuConfig'
import './AccessDeniedPage.css'

export function AccessDeniedPage() {
  const location = useLocation()
  const fromPath = location.state?.from?.pathname

  return (
    <div className="accessDeniedPage">
      <div className="accessDeniedCard">
        <div className="accessDeniedTitle">Acceso denegado</div>
        <p className="accessDeniedText">
          No tiene permisos para acceder a esta sección. Si cree que esto es un error, contacte al administrador del
          sistema.
        </p>
        {typeof fromPath === 'string' ? <div className="accessDeniedMeta">Ruta solicitada: {fromPath}</div> : null}
        <div className="accessDeniedActions">
          <Link className="btn" to={DEFAULT_PRIVATE_PATH} replace>
            Ir a una sección permitida
          </Link>
        </div>
      </div>
    </div>
  )
}
