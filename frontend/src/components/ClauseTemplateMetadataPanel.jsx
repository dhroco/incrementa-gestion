import { useId, useState } from 'react'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'

/**
 * Panel colapsable para metadatos de cláusulas y plantillas estándar.
 * Los `children` permanecen montados al contraer (solo se ocultan) para no perder estado de formulario ni del editor asociado fuera del panel.
 *
 * @param {{
 *   defaultExpanded: boolean
 *   code: string
 *   primaryLabel: string
 *   entityKind: 'clause' | 'template'
 *   children: import('react').ReactNode
 * }} props
 */
export function ClauseTemplateMetadataPanel({ defaultExpanded, code, primaryLabel, entityKind, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const regionId = useId()
  const summaryCode = code != null && String(code).trim() ? String(code).trim() : '—'
  const summaryTitle = primaryLabel != null && String(primaryLabel).trim() ? String(primaryLabel).trim() : '—'
  const noun = entityKind === 'template' ? 'plantilla' : 'cláusula'
  const expandLabel = `Expandir metadatos de la ${noun}`
  const collapseLabel = `Contraer metadatos de la ${noun}`

  return (
    <div className="clause-metadata-panel">
      <div
        className={`clause-metadata-panel__bar${expanded ? ' clause-metadata-panel__bar--hidden' : ''}`}
        role="region"
        aria-label={`Resumen de ${noun}`}
      >
        <div className="clause-metadata-panel__summary" aria-hidden>
          <span className="clause-metadata-panel__code">{summaryCode}</span>
          <span className="clause-metadata-panel__sep">·</span>
          <span className="clause-metadata-panel__title">{summaryTitle}</span>
        </div>
        <button
          type="button"
          className="clause-metadata-panel__toggle"
          aria-expanded={false}
          aria-controls={regionId}
          aria-label={expandLabel}
          onClick={() => setExpanded(true)}
        >
          <KeyboardArrowDown sx={{ fontSize: 22 }} aria-hidden />
        </button>
      </div>

      <div
        id={regionId}
        className="clause-metadata-panel__body-wrap"
        role="region"
        aria-label={`Metadatos de la ${noun}`}
        hidden={!expanded}
      >
        <div className="clause-metadata-panel__header">
          <button
            type="button"
            className="clause-metadata-panel__toggle"
            aria-expanded={expanded}
            aria-controls={regionId}
            aria-label={collapseLabel}
            onClick={() => setExpanded(false)}
          >
            <KeyboardArrowUp sx={{ fontSize: 22 }} aria-hidden />
          </button>
        </div>
        <div className="clause-metadata-panel__body">{children}</div>
      </div>
    </div>
  )
}
