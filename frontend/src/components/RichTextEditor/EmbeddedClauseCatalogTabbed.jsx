import React, { useEffect, useState } from 'react'
import styles from './styles.module.css'

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {boolean} props.showCompanyTab
 * @param {boolean} props.showUniversalTab
 * @param {Array<{ id: string, code?: string | null, title_clause?: string | null }>} props.companyOptions
 * @param {Array<{ id: string, code?: string | null, title_clause?: string | null }>} props.universalOptions
 * @param {(row: { id: string, code?: string | null, title_clause?: string | null }) => void} props.onSelectCompany
 * @param {(row: { id: string, code?: string | null, title_clause?: string | null }) => void} props.onSelectUniversal
 * @param {string} [props.companyEmptyMessage]
 * @param {string} [props.universalEmptyMessage]
 */
export default function EmbeddedClauseCatalogTabbed({
  isOpen,
  onClose,
  showCompanyTab,
  showUniversalTab,
  companyOptions = [],
  universalOptions = [],
  onSelectCompany,
  onSelectUniversal,
  companyEmptyMessage = 'No hay cláusulas por empresa disponibles para esta empresa.',
  universalEmptyMessage = 'No hay cláusulas universales disponibles.',
}) {
  const [activeTab, setActiveTab] = useState('company')
  const [selectedId, setSelectedId] = useState('')

  const twoTabs = showCompanyTab && showUniversalTab
  const options = activeTab === 'company' ? companyOptions : universalOptions
  const selected = options.find((o) => o.id === selectedId)

  useEffect(() => {
    if (!isOpen) return
    setSelectedId('')
    if (showCompanyTab) {
      setActiveTab('company')
    } else if (showUniversalTab) {
      setActiveTab('universal')
    }
  }, [isOpen, showCompanyTab, showUniversalTab])

  if (!isOpen) return null
  if (!showCompanyTab && !showUniversalTab) return null

  const onInsert = () => {
    if (!selected) return
    if (activeTab === 'company') onSelectCompany(selected)
    else onSelectUniversal(selected)
    onClose()
  }

  return (
    <div className={styles['variable-catalog-overlay']} onClick={onClose} role="presentation">
      <div className={styles['variable-catalog']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['variable-catalog-header']}>
          <h3>Insertar cláusula</h3>
          <button type="button" className={styles['close-button']} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {twoTabs ? (
          <div className={styles['embedded-clause-tabs']} role="tablist" aria-label="Origen de la cláusula">
            <button
              type="button"
              role="tab"
              id="tab-clause-company"
              aria-selected={activeTab === 'company'}
              className={`${styles['embedded-clause-tab']} ${activeTab === 'company' ? styles['embedded-clause-tab--active'] : ''}`}
              onClick={() => {
                setActiveTab('company')
                setSelectedId('')
              }}
            >
              Por empresa
            </button>
            <button
              type="button"
              role="tab"
              id="tab-clause-universal"
              aria-selected={activeTab === 'universal'}
              className={`${styles['embedded-clause-tab']} ${activeTab === 'universal' ? styles['embedded-clause-tab--active'] : ''}`}
              onClick={() => {
                setActiveTab('universal')
                setSelectedId('')
              }}
            >
              Universales
            </button>
          </div>
        ) : null}
        <div
          className={styles['embedded-clause-catalog-body']}
          role="tabpanel"
          {...(twoTabs
            ? { 'aria-labelledby': activeTab === 'company' ? 'tab-clause-company' : 'tab-clause-universal' }
            : {
                'aria-label':
                  activeTab === 'company' ? 'Cláusulas por empresa' : 'Cláusulas universales',
              })}
        >
          {options.length === 0 ? (
            <>
              <div className={styles['no-results']}>
                {activeTab === 'company' ? companyEmptyMessage : universalEmptyMessage}
              </div>
              <div className={styles['embedded-clause-catalog-actions']}>
                <button type="button" className={styles['toolbar-button']} onClick={onClose}>
                  Cerrar
                </button>
              </div>
            </>
          ) : (
            <>
              <label className={styles['embedded-clause-catalog-label']} htmlFor="embedded-clause-select-tabbed">
                Seleccione una cláusula
              </label>
              <select
                id="embedded-clause-select-tabbed"
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
                <button type="button" className={styles['toolbar-button']} disabled={!selected} onClick={onInsert}>
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
