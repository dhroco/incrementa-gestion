# Hallazgos de cierre del cambio firme-flujo-a

Devoluciones desde «confirmar cierre». El último es el que corrige la fase devolver.

## 2026-10-26T21:12:38.772Z · via

"Devolución 1 de 2: (1) Corrige la posición del recuadro «Firma electrónica del proveedor». Firme mide y desde el borde SUPERIOR de la página (el openapi dice «measured from the top edge»), pero pdf-lib mide desde el INFERIOR: hoy drawStampBox (backend/lib/firmeStamp.js) usa y = STAMP_Y * height, así que el recuadro se dibuja arriba, encima del título y del texto de la constancia, mientras Firme pone el timbre al 80 % desde arriba (abajo). Cambia a y = height - STAMP_Y * height - STAMP_HEIGHT * height (x queda igual). Actualiza backend/test/firmeStamp.test.js (archivo nuevo de la corrida): el test actual afirma 1 0 0 1 ${STAMP_X*width} ${STAMP_Y*height} cm, que consagra el error; debe afirmar el origen corregido y que el borde superior del recuadro queda en la mitad inferior de la página (no pisa la constancia). (2) En handleWebhook (backend/services/firmeSigningService.js), no persistas en firme_webhook_event los cuerpos que no sean JSON válido (hoy se guardan truncados a 1 KB: es una escritura sin autenticar en una ruta pública); solo logError sin el cuerpo. Ajusta el test correspondiente de firmeWebhook (archivo de la corrida). (3) No toques nada más; repite las pruebas del perfil y las ablaciones."
