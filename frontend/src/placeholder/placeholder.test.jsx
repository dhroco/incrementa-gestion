import { describe, expect, it } from 'vitest'
import ReactDOMServer from 'react-dom/server'
import { PlaceholderPage } from './PlaceholderPage'
import { UnderConstruction } from './UnderConstruction'
import { PlaceholderCardGrid } from './PlaceholderCardGrid'
import { PlaceholderTable } from './PlaceholderTable'

describe('placeholder components', () => {
  it('PlaceholderPage renders title and subtitle', () => {
    const html = ReactDOMServer.renderToString(<PlaceholderPage title="T" subtitle="S" />)
    expect(html).toContain('T')
    expect(html).toContain('S')
  })

  it('UnderConstruction renders default message', () => {
    const html = ReactDOMServer.renderToString(<UnderConstruction />)
    expect(html).toContain('Esta funcionalidad se encuentra en construcción')
  })

  it('PlaceholderCardGrid renders items', () => {
    const html = ReactDOMServer.renderToString(
      <PlaceholderCardGrid items={[{ title: 'A', value: '1' }, { title: 'B', value: '2' }]} />
    )
    expect(html).toContain('A')
    expect(html).toContain('2')
  })

  it('PlaceholderTable renders empty state when no rows', () => {
    const html = ReactDOMServer.renderToString(<PlaceholderTable title="X" columns={['Col']} rows={[]} />)
    expect(html).toContain('Sin datos')
  })
})

