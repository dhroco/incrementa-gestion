export function PlaceholderTable({ title, columns, rows }) {
  const cols = Array.isArray(columns) ? columns : []
  const rs = Array.isArray(rows) ? rows : []

  return (
    <div className="ph-panel">
      {title ? <div className="ph-panel__title">{title}</div> : null}
      <table className="ph-table" aria-label={title || 'Tabla'}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="ph-table__th">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rs.map((r, idx) => (
            <tr key={idx}>
              {cols.map((c) => (
                <td key={c} className="ph-table__td">
                  {r?.[c] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {rs.length === 0 ? (
            <tr>
              <td className="ph-table__td" colSpan={Math.max(cols.length, 1)}>
                Sin datos.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

