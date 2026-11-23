const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

function clean(value) {
  return String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Nombre legible del PDF firmado que va como adjunto del correo:
 * «Contrato servicios Influencer <producto> <proveedor> - <mes> <año> - firmado.pdf».
 * El mes y el año son los de la firma, en hora de Santiago. Sin producto se omite; solo cambia el
 * adjunto (el archivo guardado conserva su nombre con el id).
 */
function buildSignedAttachmentName({ productName, supplierName, signedAt }) {
  const date = signedAt instanceof Date && !Number.isNaN(signedAt.getTime()) ? signedAt : new Date()
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year').value
  const month = MONTHS[Number(parts.find((p) => p.type === 'month').value) - 1]
  const who = [clean(productName), clean(supplierName)].filter(Boolean).join(' ')
  const head = ['Contrato servicios Influencer', who].filter(Boolean).join(' ')
  return `${head} - ${month} ${year} - firmado.pdf`
}

module.exports = { buildSignedAttachmentName }
