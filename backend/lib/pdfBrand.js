/**
 * Marca en las hojas de los contratos en PDF, en las esquinas y FUERA del bloque de texto: el logo arriba a la
 * izquierda y el ícono abajo a la derecha, cada uno a la MISMA distancia (BRAND_INSET) de sus dos bordes.
 * Las imágenes están recortadas al contenido, aplanadas sobre blanco (PNG RGB sin transparencia: los lectores de
 * PDF antiguos no leen la máscara suave) y a resolución de impresión. El alto fija el tamaño y el ancho sale de la
 * proporción real del archivo. Lo usan las hojas del contrato (@react-pdf). La hoja de constancia de firma (pdf-lib)
 * no las lleva: sus pruebas existentes cuentan las imágenes del PDF firmado.
 */

const fs = require('fs')
const path = require('path')

const BRAND_DIR = path.join(__dirname, '..', 'assets', 'pdf')
const BRAND_INSET = 24 // pt (≈ 8,5 mm) desde cada borde de la hoja
const BRAND_LOGO = { file: path.join(BRAND_DIR, 'logo-incrementa.png'), height: 14.4, top: BRAND_INSET, left: BRAND_INSET }
const BRAND_ICON = { file: path.join(BRAND_DIR, 'icono-incrementa.png'), height: 19.2, bottom: BRAND_INSET, right: BRAND_INSET }

/** Ancho y alto de un PNG (cabecera IHDR: bytes 16 a 24). */
function pngSize(file) {
  const header = Buffer.alloc(24)
  const fd = fs.openSync(file, 'r')
  try {
    fs.readSync(fd, header, 0, 24, 0)
  } finally {
    fs.closeSync(fd)
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

/** Ancho y alto (pt) con que se dibuja la imagen: el alto fijo y el ancho según su proporción. */
function brandImageSize(spec) {
  const { width, height } = pngSize(spec.file)
  return { width: Math.round((spec.height * width * 10) / height) / 10, height: spec.height }
}

module.exports = { BRAND_INSET, BRAND_LOGO, BRAND_ICON, brandImageSize }
