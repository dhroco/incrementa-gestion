/**
 * Sección con separadores horizontales opcionales (sin caja con borde).
 * Por defecto regla arriba y abajo; ajustar `ruleAfter`/`ruleBefore` para evitar dobles líneas entre bloques.
 */
export function FormSection({ title, children, ruleBefore = true, ruleAfter = true }) {
  return (
    <section className="clause-form-section clause-form-section--separated">
      {ruleBefore ? <hr className="company-form-section-rule" aria-hidden="true" /> : null}
      <h3 className="clause-form-section-title">{title}</h3>
      <div className="clause-form-section-body">{children}</div>
      {ruleAfter ? <hr className="company-form-section-rule" aria-hidden="true" /> : null}
    </section>
  )
}
