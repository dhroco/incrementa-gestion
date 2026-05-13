export function PlaceholderCardGrid({ items }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="ph-card-grid" role="list" aria-label="Resumen">
      {list.map((it, idx) => (
        <div key={`${it?.title ?? 'card'}-${idx}`} className="ph-card" role="listitem">
          <div className="ph-card__title">{it?.title ?? 'Resumen'}</div>
          <div className="ph-card__value">{it?.value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

