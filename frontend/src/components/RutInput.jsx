import { formatRutInput, RUT_INPUT_PLACEHOLDER } from '../utils/rut'

/**
 * Campo de entrada estándar para RUT chileno.
 * Formatea con separador de miles (punto) y guión al perder el foco.
 * Ver openspec/config.yaml → locale.rut_format.
 */
export function RutInput({
  value,
  onChange,
  className = 'clause-input',
  optional = true,
  placeholder = RUT_INPUT_PLACEHOLDER,
  ...rest
}) {
  const current = value ?? ''

  function handleBlur() {
    const formatted = formatRutInput(current)
    if (formatted !== current) {
      onChange(formatted)
    }
  }

  return (
    <input
      className={className}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      aria-required={optional ? undefined : true}
      {...rest}
    />
  )
}
