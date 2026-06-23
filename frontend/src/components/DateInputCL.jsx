import { useEffect, useState } from 'react'
import { autoFormatDate, isoToDdMmYyyy, parseDdMmYyyyToIso } from '../utils/dateUtils'

/**
 * Input de fecha con auto-máscara dd/mm/aaaa (es-CL).
 * Recibe y emite valores en formato ISO (YYYY-MM-DD) para compatibilidad con la API.
 * El usuario puede escribir solo dígitos (ej: 01062026) — los slashes se insertan automáticamente.
 */
export function DateInputCL({ id, value, onChange, className, disabled, readOnly }) {
  const [display, setDisplay] = useState(() => isoToDdMmYyyy(value) || '')

  useEffect(() => {
    const expectedDisplay = isoToDdMmYyyy(value) || ''
    const isoFromDisplay = parseDdMmYyyyToIso(display) || ''
    if (value !== isoFromDisplay) setDisplay(expectedDisplay)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e) {
    const formatted = autoFormatDate(e.target.value)
    setDisplay(formatted)
    const iso = parseDdMmYyyyToIso(formatted)
    if (iso) onChange(iso)
    else if (formatted === '') onChange('')
  }

  return (
    <input
      id={id}
      type="text"
      className={className}
      value={display}
      placeholder="dd/mm/aaaa"
      onChange={handleChange}
      disabled={disabled}
      readOnly={readOnly}
    />
  )
}
