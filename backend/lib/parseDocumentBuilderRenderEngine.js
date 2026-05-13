const DB = {
  'pdf-lib': 'pdf_lib',
  'react-pdf': 'react_pdf',
}

const ALLOWED = new Set(Object.keys(DB))

/**
 * @param {unknown} body
 * @returns {{ ok: true, input: 'pdf-lib' | 'react-pdf', storage: 'pdf_lib' | 'react_pdf' } | { ok: false, message: string }}
 */
function parseDocumentBuilderRenderEngine(body) {
  const raw = body && 'renderEngine' in body ? body.renderEngine : undefined
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, input: 'pdf-lib', storage: 'pdf_lib' }
  }
  if (typeof raw !== 'string' || !ALLOWED.has(raw)) {
    return {
      ok: false,
      message: 'Parámetro renderEngine inválido. Use "pdf-lib" o "react-pdf".',
    }
  }
  return { ok: true, input: /** @type {'pdf-lib' | 'react-pdf'} */ (raw), storage: DB[raw] }
}

module.exports = {
  parseDocumentBuilderRenderEngine,
  RENDER_ENGINES_DB: { ...DB },
}
