const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { Font } = require('@react-pdf/renderer')

const { buildPdfBytesFromTipTapWithReactPdf } = require('../services/documentBuilderTipTapReactPdf')

// El lector se ejecuta en un proceso aparte, como en las otras pruebas que leen PDF.
function extractText(buf) {
  const code = `
    (async () => {
      const pdfParse = require('pdf-parse');
      const r = await pdfParse(Buffer.from(process.env.PDF_B64, 'base64'));
      process.stdout.write(r.text || '');
    })().catch((e) => { process.stderr.write(String(e && e.message ? e.message : e)); process.exit(1); });
  `
  const r = spawnSync(process.execPath, ['-e', code], {
    env: { ...process.env, PDF_B64: Buffer.from(buf).toString('base64') },
    encoding: 'utf8'
  })
  if (r.status !== 0) throw new Error(`pdf-parse failed: ${String(r.stderr || '').slice(0, 200)}`)
  return r.stdout
}

const PARRAFO =
  'El Influencer se obliga a efectuar la despublicación de cualquier contenido, incluyendo la comunicación extrajudicial y la indemnización de perjuicios. '.repeat(14)

test('el corte automático de palabras con guion está apagado', () => {
  const callback = Font.getHyphenationCallback()
  assert.equal(typeof callback, 'function')
  assert.deepEqual(callback('despublicación'), ['despublicación'])
  assert.deepEqual(callback('SPA,'), ['SPA,'])
})

test('en un párrafo justificado largo ninguna línea termina partida con guion y las palabras quedan completas', async () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'justify' }, content: [{ type: 'text', text: PARRAFO }] }] }
  const text = extractText(await buildPdfBytesFromTipTapWithReactPdf(doc))
  assert.equal((text.match(/[a-záéíóúñ]-\n/gi) || []).length, 0, 'hay palabras partidas con guion al final de línea')
  assert.equal((text.match(/despublicación/g) || []).length, 14)
  assert.equal((text.match(/extrajudicial/g) || []).length, 14)
})

test('un guion que escribió el redactor (p. ej. un RUT o «19.799-A») no se toca', async () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'RUT 12.345.678-5 y Ley N° 19.799-A.' }] }] }
  const text = extractText(await buildPdfBytesFromTipTapWithReactPdf(doc))
  assert.match(text, /12\.345\.678-5/)
  assert.match(text, /19\.799-A/)
})

test('un texto en negrita pegado a una coma («SPA» + «,») nunca se parte con guion, caiga donde caiga el fin de línea', async () => {
  const FILLER = 'palabra '
  const lineasMalas = []
  for (let i = 0; i <= 24; i++) {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'justify' },
          content: [
            { type: 'text', text: `En Prueba de Chile, a 10 de noviembre de 2026, entre, por una parte, ${FILLER.repeat(i)}` },
            { type: 'text', text: 'DYNAMICS CORP. SPA', marks: [{ type: 'bold' }] },
            { type: 'text', text: ', Rol Único Tributario N°77465341-4, representada por Yerko Reckmann Osorio, cédula de identidad N°15563467-7, ambos domiciliados en Avenida Kennedy 9070, oficina 602A, comuna de Vitacura.' }
          ]
        }
      ]
    }
    const text = extractText(await buildPdfBytesFromTipTapWithReactPdf(doc))
    for (const linea of text.split('\n')) {
      if (/[A-Za-záéíóúñ]-$/.test(linea.trimEnd()) || /^\s*,/.test(linea)) lineasMalas.push(`#${i}: ${linea}`)
    }
  }
  assert.deepEqual(lineasMalas, [], `líneas partidas o que empiezan con coma:\n${lineasMalas.join('\n')}`)
})
