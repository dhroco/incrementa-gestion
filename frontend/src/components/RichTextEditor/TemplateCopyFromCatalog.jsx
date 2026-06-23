import { useEffect, useMemo, useState } from 'react'
import { fetchStandardTemplatesList } from '../../api/standardTemplatesApi'
import { mapTemplateStatusToSpanish } from '../../utils/templateStatus'
import { SupplierTypeChip } from '../SupplierTypeChip'
import styles from './styles.module.css'

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onTemplateSelect: (template: { id: string, name?: string, code?: string }) => void,
 *   accessToken: string | null,
 *   excludeTemplateId?: string | null,
 * }} props
 */
export default function TemplateCopyFromCatalog({
  isOpen,
  onClose,
  onTemplateSelect,
  excludeTemplateId = null,
}) {
  const [searchText, setSearchText] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined

    let active = true
    const controller = new AbortController()

    async function loadTemplates() {
      setLoading(true)
      setError(null)
      const res = await fetchStandardTemplatesList({
        signal: controller.signal,
        q: searchText.trim() || undefined,
      })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setItems([])
        setError(res.message ?? 'No se pudieron cargar las plantillas.')
        return
      }
      const list = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : []
      setItems(list)
      setError(null)
    }

    const timer = window.setTimeout(loadTemplates, searchText.trim() ? 250 : 0)
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [isOpen, searchText])

  const filteredItems = useMemo(() => {
    const excludeId = excludeTemplateId ? String(excludeTemplateId) : null
    return items.filter((item) => {
      if (!item || typeof item !== 'object') return false
      if (excludeId && String(item.id) === excludeId) return false
      return true
    })
  }, [items, excludeTemplateId])

  const handleTemplateClick = (template) => {
    if (!template?.id) return
    onTemplateSelect({
      id: String(template.id),
      name: typeof template.name === 'string' ? template.name : '',
      code: typeof template.code === 'string' ? template.code : '',
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles['variable-catalog-overlay']} onClick={onClose} role="presentation">
      <div className={styles['variable-catalog']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['variable-catalog-header']}>
          <h3>Copiar desde plantilla</h3>
          <button type="button" className={styles['close-button']} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles['variable-catalog-controls']}>
          <input
            type="text"
            placeholder="Buscar por nombre o código…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles['search-input']}
            autoFocus
          />
        </div>

        <div className={styles['variable-list']}>
          {loading ? <div className={styles['no-results']}>Cargando plantillas…</div> : null}
          {!loading && error ? <div className={styles['no-results']}>{error}</div> : null}
          {!loading && !error && filteredItems.length === 0 ? (
            <div className={styles['no-results']}>No se encontraron plantillas</div>
          ) : null}
          {!loading && !error
            ? filteredItems.map((template) => {
                const label =
                  [template.code, template.name].filter((part) => typeof part === 'string' && part.trim()).join(' — ') ||
                  'Plantilla sin nombre'
                return (
                  <button
                    type="button"
                    key={String(template.id)}
                    className={styles['template-copy-item']}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <div className={styles['variable-item-header']}>
                      <span className={styles['variable-label']}>{label}</span>
                      <span className={styles['template-copy-item-meta']}>
                        {template.supplier_type ? <SupplierTypeChip supplierType={template.supplier_type} /> : null}
                        {template.status ? (
                          <span className={styles['template-copy-item-status']}>
                            {mapTemplateStatusToSpanish(template.status)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {typeof template.description === 'string' && template.description.trim() ? (
                      <div className={styles['variable-description']}>{template.description.trim()}</div>
                    ) : null}
                  </button>
                )
              })
            : null}
        </div>
      </div>
    </div>
  )
}
