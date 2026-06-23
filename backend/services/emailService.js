const { Resend } = require('resend')
const config = require('../config')

async function sendSignedContractEmail({ to, proveedorNombre, templateName, pdfBuffer, fileName }) {
  const apiKey = config.RESEND_API_KEY || process.env.RESEND_API_KEY || ''
  const from = config.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const subject = `Contrato firmado — ${proveedorNombre} — ${templateName}`

  const html = `
    <p>Estimado/a,</p>
    <p>Le informamos que el contrato con <strong>${proveedorNombre}</strong> (plantilla: <strong>${templateName}</strong>) ha sido firmado electrónicamente de acuerdo con la Ley N° 19.799 sobre Firma Electrónica.</p>
    <p>Adjunto encontrará el documento PDF firmado para su archivo.</p>
    <p>Atentamente,<br/>Incrementa</p>
  `.trim()

  if (!apiKey) {
    console.error('[emailService] RESEND_API_KEY ausente: se omite el envío de correo (skipped).')
    return { ok: true, skipped: true }
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: [{ filename: fileName, content: pdfBuffer.toString('base64') }]
  })

  return { ok: true }
}

module.exports = { sendSignedContractEmail }
