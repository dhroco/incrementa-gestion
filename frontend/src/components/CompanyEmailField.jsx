/**
 * Correo(s) de la empresa: una dirección por línea, en una caja con scroll cuando son varias.
 * El texto se guarda como «a@x.cl, b@x.cl» (ver `emailListToStored`).
 */
export default function CompanyEmailField({ value, onChange, valid }) {
  return (
    <>
      <div className="clause-label">Correo (una dirección por línea)</div>
      <textarea
        className="clause-textarea"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="nombre@empresa.cl"
        spellCheck={false}
        style={{ maxHeight: '96px', overflowY: 'auto' }}
      />
      {!valid && value.trim().length ? (
        <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>Correo inválido.</div>
      ) : null}
    </>
  )
}
