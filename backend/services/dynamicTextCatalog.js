const DYNAMIC_TEXT_CATALOG = {
  servicios_entregables: {
    label: 'Entregables (cláusula 2.3)',
    instruccion:
      'Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.',
    ejemplos: [
      'un (1) reel en Instagram',
      'cinco (5) reels en TikTok y cuatro (4) reels en Facebook',
      'dos (2) stories y un (1) reel en Instagram'
    ]
  },
  cuentas_publicacion: {
    label: 'Cuentas de publicación (cláusula 2.5)',
    instruccion: 'Escribe la cuenta del influencer en cada red social nombrada en los entregables.',
    ejemplos: [
      'su cuenta de Instagram @danarebolledo',
      'su cuenta de TikTok @danarebolledo y su cuenta de Facebook Dana Rebolledo'
    ]
  }
}

function getDynamicTextDefinition(id) {
  return DYNAMIC_TEXT_CATALOG[id]
}

module.exports = {
  DYNAMIC_TEXT_CATALOG,
  getDynamicTextDefinition
}
