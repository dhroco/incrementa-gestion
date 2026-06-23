import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSocialNetworkCatalog } from '../api/suppliersApi'
import './SocialNetworkSelector.css'

const iconModules = import.meta.glob('../assets/social-networks/*.svg', {
  eager: true,
  import: 'default'
})

function resolveSocialIconUrl(code) {
  const key = `../assets/social-networks/${code}.svg`
  return iconModules[key] ?? iconModules['../assets/social-networks/generic.svg']
}

function displayText(v) {
  if (v == null) return '—'
  const s = String(v).trim()
  return s === '' ? '—' : s
}

/**
 * @param {{
 *  value?: Array<{ catalog_id: string, account_name: string, code?: string, name?: string }>,
 *  onChange?: (networks: Array<{ catalog_id: string, account_name: string, code?: string, name?: string }>) => void,
 *  readOnly?: boolean,
 *  fieldError?: string,
 *  accessToken?: string | null
 * }} props
 */
export function SocialNetworkSelector({
  value = [],
  onChange,
  readOnly = false,
  fieldError = null
}) {
  const [catalogItems, setCatalogItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    let active = true
    async function load() {
      setLoading(true)
      const res = await fetchSocialNetworkCatalog({})
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setLoadError(res.message ?? 'No se pudo cargar el catálogo de redes sociales.')
        return
      }
      setCatalogItems(Array.isArray(res.data?.items) ? res.data.items : [])
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const selectedMap = useMemo(() => {
    const map = new Map()
    for (const sn of value || []) {
      if (sn?.catalog_id) map.set(sn.catalog_id, sn)
    }
    return map
  }, [value])

  const catalogById = useMemo(() => {
    const map = new Map()
    for (const item of catalogItems) {
      map.set(item.id, item)
    }
    return map
  }, [catalogItems])

  function resolveNetworkMeta(sn) {
    const fromCatalog = catalogById.get(sn.catalog_id)
    return {
      code: sn.code || fromCatalog?.code || '',
      name: sn.name || fromCatalog?.name || sn.catalog_id
    }
  }

  function toggleNetwork(catalogId, code, name) {
    if (readOnly || !onChange) return
    if (selectedMap.has(catalogId)) {
      onChange((value || []).filter((sn) => sn.catalog_id !== catalogId))
      return
    }
    onChange([...(value || []), { catalog_id: catalogId, account_name: '', code, name }])
  }

  function updateAccount(catalogId, accountName) {
    if (readOnly || !onChange) return
    onChange(
      (value || []).map((sn) =>
        sn.catalog_id === catalogId ? { ...sn, account_name: accountName } : sn
      )
    )
  }

  if (readOnly) {
    const networks = value || []
    if (networks.length === 0) {
      return <p className="clause-list-empty">No hay redes sociales registradas.</p>
    }
    return (
      <ul className="social-network-selector-readonly">
        {networks.map((sn) => {
          const { code, name } = resolveNetworkMeta(sn)
          return (
            <li key={sn.catalog_id || `${code}-${sn.account_name}`} className="social-network-selector-readonly-item">
              <img src={resolveSocialIconUrl(code)} alt="" className="social-network-selector-icon" aria-hidden />
              <span className="social-network-selector-readonly-name">{displayText(name)}</span>
              <span className="social-network-selector-readonly-handle">{displayText(sn.account_name)}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="social-network-selector">
      {fieldError ? <div className="clause-field-error">{fieldError}</div> : null}
      {loading ? <div className="clause-list-loading">Cargando catálogo…</div> : null}
      {loadError ? <div className="clause-error">{loadError}</div> : null}
      {!loading && !loadError ? (
        <div className="social-network-selector-grid" role="group" aria-label="Redes sociales disponibles">
          {catalogItems.map((item) => {
            const selected = selectedMap.get(item.id)
            const isSelected = Boolean(selected)
            return (
              <div
                key={item.id}
                className={`social-network-selector-card${isSelected ? ' social-network-selector-card--selected' : ''}`}
              >
                <button
                  type="button"
                  className="social-network-selector-card-toggle"
                  aria-pressed={isSelected}
                  onClick={() => toggleNetwork(item.id, item.code, item.name)}
                >
                  <img
                    src={resolveSocialIconUrl(item.code)}
                    alt=""
                    className="social-network-selector-icon"
                    aria-hidden
                  />
                  <span className="social-network-selector-card-name">{item.name}</span>
                </button>
                {isSelected ? (
                  <input
                    type="text"
                    className="clause-input social-network-selector-handle-input"
                    value={selected?.account_name ?? ''}
                    onChange={(e) => updateAccount(item.id, e.target.value)}
                    placeholder="Ej: @miempresa"
                    aria-label={`Cuenta en ${item.name}`}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
