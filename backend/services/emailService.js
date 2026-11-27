const { parseEmailList } = require('../utils/emailList')

/**
 * Azure Communication Services Email: autentica con la identidad administrada del contenedor
 * (o `az login` en local); sin claves. `beginSend` vuelve cuando ACS acepta el mensaje; el resultado
 * final se vigila aparte para no dejar esperando al webhook de Firme.
 */
async function sendWithAcs({ endpoint, from, recipients, subject, html, pdfBuffer, fileName }) {
  const attachments = pdfBuffer
    ? [{ name: fileName, contentType: 'application/pdf', contentInBase64: pdfBuffer.toString('base64') }]
    : undefined
  const { EmailClient } = require('@azure/communication-email')
  const { DefaultAzureCredential } = require('@azure/identity')
  const client = new EmailClient(endpoint, new DefaultAzureCredential())
  const poller = await client.beginSend({
    senderAddress: from,
    recipients: { to: recipients.map((address) => ({ address })) },
    content: { subject, html },
    ...(attachments ? { attachments } : {})
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

  const endpoint = process.env.ACS_EMAIL_ENDPOINT || ''
  const from = process.env.ACS_EMAIL_FROM || ''
  if (!endpoint || !from) {
    console.error('[emailService] ACS_EMAIL_ENDPOINT/ACS_EMAIL_FROM ausentes: se omite el envío de correo (skipped).')
    return { ok: true, skipped: true }
  }

  await sendWithAcs({ endpoint, from, recipients, subject, html, pdfBuffer, fileName })
  return { ok: true }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

/**
 * Aviso a la empresa de contratos cuyo enlace de firma está por vencer (hours = 48 o 24).
 * items: [{ signeeName, templateName, productName, expiresAtText }]
 */
async function sendExpiryAlertEmail({ to, hours, items }) {
  const count = items.length
  const subject = `Firma por vencer en ${hours} horas — ${count} contrato${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'}`
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(item.signeeName)}</td>` +
        `<td style="padding:4px 12px 4px 0">${escapeHtml(item.templateName)}${item.productName ? ` · ${escapeHtml(item.productName)}` : ''}</td>` +
        `<td style="padding:4px 0">${escapeHtml(item.expiresAtText)}</td></tr>`
    )
    .join('')
  const html = `
    <p>Estimados,</p>
    <p>${count === 1 ? 'Este contrato está enviado' : 'Estos contratos están enviados'} a firma sin que el influencer ${count === 1 ? 'lo haya firmado' : 'los haya firmado'}, y el enlace de firma vence en menos de <strong>${hours} horas</strong>:</p>
    <table style="border-collapse:collapse"><thead><tr><th align="left" style="padding:4px 12px 4px 0">Influencer</th><th align="left" style="padding:4px 12px 4px 0">Contrato</th><th align="left" style="padding:4px 0">Vence</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Para renovarlo, abra «Firma de documento» en Incrementa Gestión y use «Reenviar enlace» en cada contrato.</p>
    <p>Atentamente,<br/>Incrementa</p>
  `.trim()

  const recipients = parseEmailList(to)
  if (recipients.length === 0) {
    console.error('[emailService] sin destinatarios: se omite el aviso de vencimiento (skipped).')
    return { ok: true, skipped: true }
  }
  const endpoint = process.env.ACS_EMAIL_ENDPOINT || ''
  const from = process.env.ACS_EMAIL_FROM || ''
  if (!endpoint || !from) {
    console.error('[emailService] ACS_EMAIL_ENDPOINT/ACS_EMAIL_FROM ausentes: se omite el aviso de vencimiento (skipped).')
    return { ok: true, skipped: true }
  }
  await sendWithAcs({ endpoint, from, recipients, subject, html })
  return { ok: true }
}

module.exports = { sendSignedContractEmail, sendExpiryAlertEmail }
