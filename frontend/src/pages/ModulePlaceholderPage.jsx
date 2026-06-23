import { PlaceholderTable } from '../placeholder/PlaceholderTable'
import { PlaceholderToolbar } from '../placeholder/PlaceholderToolbar'
import { UnderConstructionBlock } from '../components/AsyncStateBlock'
import { PageShell } from '../components/PageShell'
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function ModulePlaceholderPage({ title, subtitle, kind = 'list', actions }) {
  const showToolbar = Array.isArray(actions) && actions.length > 0
  const safeSubtitle = isNonEmptyString(subtitle) ? subtitle : 'Pantalla en construcción.'

  const subHeaderActionsNode = showToolbar ? (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {actions.map((a, idx) => (
        <button
          key={`${a?.label ?? 'action'}-${idx}`}
          type="button"
          className="btn"
          disabled
          title="Acción no disponible (en construcción)"
        >
          {a?.label ?? 'Acción'}
        </button>
      ))}
    </div>
  ) : null

  return (
    <PageShell title={title} subtitle={safeSubtitle} actions={subHeaderActionsNode}>
      <>
        <UnderConstructionBlock />
          {showToolbar ? <PlaceholderToolbar>{/* acciones en subheader */}</PlaceholderToolbar> : null}
          {kind === 'detail' ? (
            <PlaceholderTable
              title="Detalle"
              columns={['Campo', 'Valor']}
              rows={[
                { Campo: '—', Valor: '—' },
                { Campo: '—', Valor: '—' },
                { Campo: '—', Valor: '—' }
              ]}
            />
          ) : (
            <PlaceholderTable
              title="Listado"
              columns={['Columna 1', 'Columna 2', 'Estado']}
              rows={[
                { 'Columna 1': '—', 'Columna 2': '—', Estado: '—' },
                { 'Columna 1': '—', 'Columna 2': '—', Estado: '—' },
                { 'Columna 1': '—', 'Columna 2': '—', Estado: '—' }
              ]}
            />
          )}
      </>
    </PageShell>
  )
}
