/**
 * CONTRATO_0018 (Empresa por un día con Canje más Pago) + Boost, y CONTRATO_0019 (lo mismo, con personería por escritura pública).
 * Las dos reescrituras son funciones puras sobre el `content_json` vivo: buscan por texto, no por posición; son idempotentes
 * y devuelven `mismatch` (sin tocar nada) si la estructura esperada no está. Los textos nuevos son los mismos que ya usan
 * CONTRATO_0002 (boost en 2.4) y CONTRATO_0004 (personería por escritura pública) en producción.
 */

const BOOST_MARKER = 'amplificación pagada (boost)'
const BOOST_TEXT_AFTER_NAME = '. Por otro lado, '
const BOOST_TEXT_AFTER_SECOND_NAME =
  ' podrá realizar una amplificación pagada (boost) de los Contenidos publicados por el Influencer por un período máximo de 30 días corridos, contados desde la fecha de su publicación.'

// Párrafo de personería del proveedor de CONTRATO_0004 (Empresa escritura pública), tal cual está en producción.
const PERSONERIA_ESCRITURA_PUBLICA = {
  "type": "paragraph",
  "attrs": {
    "textAlign": "justify"
  },
  "content": [
    {
      "text": "La personería de ",
      "type": "text"
    },
    {
      "type": "variable",
      "attrs": {
        "bold": false,
        "group": "proveedor",
        "label": "Representante Legal",
        "italic": false,
        "underline": false,
        "uppercase": false,
        "variableId": "proveedor_rep_legal"
      }
    },
    {
      "text": " para representar a ",
      "type": "text"
    },
    {
      "type": "variable",
      "attrs": {
        "bold": false,
        "group": "proveedor",
        "label": "Nombre / Razón Social",
        "italic": false,
        "underline": false,
        "uppercase": false,
        "variableId": "proveedor_nombre"
      },
      "marks": [
        {
          "type": "uppercase"
        }
      ]
    },
    {
      "text": " consta en Escritura pública de fecha ",
      "type": "text"
    },
    {
      "type": "variable",
      "attrs": {
        "bold": false,
        "group": "proveedor",
        "label": "Fecha Escritura Pública",
        "italic": false,
        "underline": false,
        "uppercase": false,
        "variableId": "fecha_escritura"
      }
    },
    {
      "text": ", reducida a escritura pública con misma fecha, en la ",
      "type": "text"
    },
    {
      "type": "variable",
      "attrs": {
        "bold": false,
        "group": "proveedor",
        "label": "Nombre Notaría",
        "italic": false,
        "underline": false,
        "uppercase": false,
        "variableId": "nombre_notaria"
      }
    },
    {
      "text": " de ",
      "type": "text"
    },
    {
      "type": "variable",
      "attrs": {
        "bold": false,
        "group": "proveedor",
        "label": "Nombre Notario",
        "italic": false,
        "underline": false,
        "uppercase": false,
        "variableId": "nombre_notario"
      }
    },
    {
      "text": ".",
      "type": "text"
    }
  ]
}

function flat(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (node.type === 'variable') return `{{${node.attrs?.variableId}}}`
  return (node.content || []).map(flat).join('')
}

function hasVariable(node, variableId) {
  if (!node) return false
  if (node.type === 'variable') return node.attrs?.variableId === variableId
  return (node.content || []).some((child) => hasVariable(child, variableId))
}

function mismatch(reason) {
  return { status: 'mismatch', reason }
}

/** Agrega el boost a la cláusula 2.4. */
function addBoostToClause24(doc) {
  const paragraphs = doc?.content
  if (!Array.isArray(paragraphs)) return mismatch('documento sin contenido')
  const found = paragraphs
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === 'paragraph' && flat(node).startsWith('2.4 El Influencer declara contar'))
  if (found.length !== 1) return mismatch(`cláusula 2.4: se esperaba 1 y hay ${found.length}`)
  const { node, index } = found[0]
  if (flat(node).includes(BOOST_MARKER)) return { status: 'already' }

  const parts = node.content
  const last = parts[parts.length - 1]
  const name = parts[parts.length - 2]
  if (last?.type !== 'text' || last.text !== '.' || name?.type !== 'variable' || name.attrs?.variableId !== 'company_nombre_comercial') {
    return mismatch('cláusula 2.4: no termina en «{{company_nombre_comercial}}.»')
  }
  const next = structuredClone(doc)
  const target = next.content[index]
  target.content = [
    ...target.content.slice(0, -1),
    { text: BOOST_TEXT_AFTER_NAME, type: 'text' },
    structuredClone(name),
    { text: BOOST_TEXT_AFTER_SECOND_NAME, type: 'text' }
  ]
  return { status: 'applied', content: next }
}

/** Cambia la personería del proveedor (Certificado de Estatuto) por la de escritura pública. */
function personeriaEscrituraPublica(doc) {
  const paragraphs = doc?.content
  if (!Array.isArray(paragraphs)) return mismatch('documento sin contenido')
  const personerias = paragraphs
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === 'paragraph' && flat(node).startsWith('La personería de {{proveedor_rep_legal}}'))
  if (personerias.length !== 1) return mismatch(`personería del proveedor: se esperaba 1 y hay ${personerias.length}`)
  const { node, index } = personerias[0]
  if (hasVariable(node, 'fecha_escritura')) return { status: 'already' }
  if (!hasVariable(node, 'fecha_estatuto')) return mismatch('personería del proveedor: no es la del Certificado de Estatuto')
  const next = structuredClone(doc)
  next.content[index] = structuredClone(PERSONERIA_ESCRITURA_PUBLICA)
  return { status: 'applied', content: next }
}

module.exports = { addBoostToClause24, personeriaEscrituraPublica, PERSONERIA_ESCRITURA_PUBLICA, flat }
