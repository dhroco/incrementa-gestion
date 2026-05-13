import './placeholder.css'

export function PlaceholderPage({ title, subtitle, children }) {
  return (
    <div className="ph-page">
      <div className="ph-header">
        <div className="ph-title">{title}</div>
        {subtitle ? <div className="ph-subtitle">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  )
}

