import { useEffect, useRef, useState } from 'react'

/**
 * Input con autocompletado. Llama a fetchOptions(text) con debounce y muestra
 * un dropdown con los resultados. Cuando el usuario selecciona una opción,
 * llama a onSelect({ id, label }). Cuando limpia, llama a onSelect(null).
 *
 * @param {{
 *   value: string | null,
 *   displayValue: string,
 *   onSelect: (option: { id: string, label: string } | null) => void,
 *   fetchOptions: (search: string) => Promise<Array<{ id: string, label: string }>>,
 *   placeholder?: string,
 *   className?: string
 * }} props
 */
export function AutocompleteInput({ value, displayValue, onSelect, fetchOptions, placeholder, className }) {
  const [text, setText] = useState(displayValue || '')
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    setText(value ? (displayValue || '') : '')
  }, [value, displayValue])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        if (!value) setText('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    if (value) onSelect(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (!val.trim()) {
      setOptions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        const results = await fetchOptions(val.trim())
        if (!controller.signal.aborted) {
          setOptions(results)
          setOpen(results.length > 0)
        }
      } catch {
        if (!controller.signal.aborted) setOptions([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
  }

  function handleSelect(option) {
    setText(option.label)
    setOptions([])
    setOpen(false)
    onSelect(option)
  }

  function handleClear() {
    setText('')
    setOptions([])
    setOpen(false)
    onSelect(null)
  }

  return (
    <div ref={containerRef} className="autocomplete-wrap">
      <div className="autocomplete-input-row">
        <input
          type="text"
          className={className}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onFocus={() => { if (options.length > 0 && !value) setOpen(true) }}
          autoComplete="off"
        />
        {value ? (
          <button type="button" className="autocomplete-clear-btn" onClick={handleClear} title="Limpiar">
            ×
          </button>
        ) : loading ? (
          <span className="autocomplete-spinner" aria-hidden="true">…</span>
        ) : null}
      </div>
      {open && options.length > 0 && (
        <ul className="autocomplete-dropdown" role="listbox">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="autocomplete-option"
              role="option"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt) }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
