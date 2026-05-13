import React, { useState } from 'react'
import styles from './styles.module.css'

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Array<{ id: string, code?: string | null, title_clause?: string | null }>} props.options
 * @param {(row: { id: string, code?: string | null, title_clause?: string | null }) => void} props.onSelect
 * @param {string} [props.catalogTitle]
 * @param {string} [props.emptyMessage]
 */
export default function EmbeddedClauseCatalog({
  isOpen,
  onClose,
  options,
  onSelect,
  catalogTitle = 'Insertar cláusula universal',
  emptyMessage = 'No hay cláusulas universales disponibles.',
}) {
  const [selectedId, setSelectedId] = useState('')

  if (!isOpen) return null

  const selected = options.find((o) => o.id === selectedId)

  return (
    <div className={styles['variable-catalog-overlay']} onClick={onClose} role="presentation">
      <div className={styles['variable-catalog']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['variable-catalog-header']}>
          <h3>{catalogTitle}</h3>
          <button type="button" className={styles['close-button']} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles['embedded-clause-catalog-body']}>
          {options.length === 0 ? (
            <div className={styles['no-results']}>{emptyMessage}</div>
          ) : (
            <>
              <label className={styles['embedded-clause-catalog-label']} htmlFor="embedded-clause-select">
                Seleccione una cláusula
              </label>
              <select
                id="embedded-clause-select"
                className={styles['embedded-clause-select']}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {(o.code || '').trim()} — {(o.title_clause || '').trim()}
                  </option>
                ))}
              </select>
              <div className={styles['embedded-clause-catalog-actions']}>
                <button type="button" className={styles['toolbar-button']} onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles['toolbar-button']}
                  disabled={!selected}
                  onClick={() => {
                    if (!selected) return
                    onSelect(selected)
                    onClose()
                  }}
                >
                  Insertar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
