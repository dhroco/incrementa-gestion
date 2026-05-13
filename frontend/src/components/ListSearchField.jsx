import SearchIcon from '@mui/icons-material/Search'
import './ListSearchField.css'

/**
 * Campo de búsqueda compacto con ícono de lupa a la izquierda (guía ERP).
 */
export function ListSearchField({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  autoComplete = 'off'
}) {
  return (
    <div className="list-search-field">
      <SearchIcon className="list-search-field__icon" sx={{ fontSize: 18 }} aria-hidden />
      <input
        id={id}
        className="list-search-field__input"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  )
}
