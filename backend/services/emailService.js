const { Resend } = require('resend')
const config = require('../config')
const { parseEmailList } = require('../utils/emailList')

/**
 * Azure Communication Services Email: autentica con la identidad administrada del contenedor
 * (o `az login` en local); sin claves. `beginSend` vuelve cuando ACS acepta el mensaje; el resultado
 * final se vigila aparte para no dejar esperando al webhook de Firme.
 */
async function sendWithAcs({ endpoint, from, recipients, subject, html, pdfBuffer, fileName }) {
  const { EmailClient } = require('@azure/communication-email')
  const { DefaultAzureCredential } = require('@azure/identity')
  const client = new EmailClient(endpoint, new DefaultAzureCredential())
  const poller = await client.beginSend({
    senderAddress: from,
    recipients: { to: recipients.map((address) => ({ address })) },
    content: { subject, html },
    attachments: [
      { name: fileName, contentType: 'application/pdf', contentInBase64: pdfBuffer.toString('base64') }
    ]
  })
  Promise.resolve(poller.pollUntilDone())
    .then((result) => {
      if (result && result.status && result.status !== 'Succeeded') {
        console.error(`[emailService] ACS terminó con estado ${result.status}`)
      }
    })
    .catch((err) => console.error(`[emailService] ACS falló al entregar (${err && err.code})`))
}

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

  const recipients = parseEmailList(to)
  if (recipients.length === 0) {
    console.error('[emailService] sin destinatarios: se omite el envío de correo (skipped).')
    return { ok: true, skipped: true }
  }

  const acsEndpoint = process.env.ACS_EMAIL_ENDPOINT || ''
  if (acsEndpoint) {
    const acsFrom = process.env.ACS_EMAIL_FROM || ''
    if (!acsFrom) {
      console.error('[emailService] ACS_EMAIL_FROM ausente: se omite el envío de correo (skipped).')
      return { ok: true, skipped: true }
    }
    await sendWithAcs({
      endpoint: acsEndpoint,
      from: acsFrom,
      recipients,
      subject,
      html,
      pdfBuffer,
      fileName
    })
    return { ok: true }
  }

  if (!apiKey) {
    console.error('[emailService] RESEND_API_KEY ausente: se omite el envío de correo (skipped).')
    return { ok: true, skipped: true }
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from,
    to: recipients,
    subject,
    html,
    attachments: [{ filename: fileName, content: pdfBuffer.toString('base64') }]
  })

  return { ok: true }
}

module.exports = { sendSignedContractEmail }
