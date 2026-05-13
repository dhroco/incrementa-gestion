import { PlaceholderTable } from '../placeholder/PlaceholderTable'
import { PlaceholderToolbar } from '../placeholder/PlaceholderToolbar'
import { UnderConstructionBlock } from '../components/AsyncStateBlock'
import { PageShell } from '../components/PageShell'
import RichTextEditor from '../components/RichTextEditor'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function ModulePlaceholderPage({ title, subtitle, kind = 'list', actions }) {
  const showToolbar = Array.isArray(actions) && actions.length > 0
  const safeSubtitle = isNonEmptyString(subtitle) ? subtitle : 'Pantalla en construcción.'
  
  // Show clause editor for pages with "cláusulas" in the title
  const isClausePage = typeof title === 'string' && title.toLowerCase().includes('cláusulas')

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
      {isClausePage ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: '#F7F7F7', border: '1px solid #E3E6E8', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: 'black' }}>
              Editor de Cláusulas - Versión de Prueba
            </h3>
            <p style={{ fontSize: '13px', margin: '0 0 16px 0', color: '#666' }}>
              Esta es una versión temporal del editor para pruebas. En el futuro se integrará con el sistema completo de gestión de cláusulas.
            </p>
            <RichTextEditor />
          </div>
        </div>
      ) : (
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
      )}
    </PageShell>
  )
}
