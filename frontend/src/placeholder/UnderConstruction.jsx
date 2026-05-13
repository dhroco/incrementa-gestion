export function UnderConstruction({ message }) {
  const msg = message || 'Esta funcionalidad se encuentra en construcción.'
  return (
    <div className="ph-under-construction" role="note" aria-label="Funcionalidad en construcción">
      {msg}
    </div>
  )
}

