# Observaciones de Marcela — registro y estado

> Registro de las observaciones de la usuaria de pre-producción y su resolución.
> **La respuesta se le enviará consolidada**, no tema por tema. Este documento
> acumula el material para redactarla.
>
> Última actualización: 22 de septiembre de 2026 (Tema 5).

---

## Tema 1 — La firma del documento debe quedar escrita

**Qué pidió** (con muestra adjunta: `Contrato servicios Influencer Solbiot Catalina Paz Maya - agosto 2026 - firmado.pdf`, firmado con Adobe Acrobat Sign): que todo el proceso de firma quede como en esa muestra.

**Qué mostraba la muestra.** El análisis forense está en `docs/firma-electronica-arquitectura.html`. Son dos mitades con mecanismos distintos:

1. La firma de la **empresa** ya venía incrustada como imagen antes de enviar el documento — no hay ningún evento de e-firma del representante legal en la bitácora.
2. La firma de la **contraparte** se captura remotamente: email → enlace → dibuja en el celular. El reporte de auditoría lo registra como `MOBILE_DRAW`.

### Estado

| Mitad | Estado |
|---|---|
| Firma escrita de la empresa | ✅ **Implementada y desplegada** en pre-prod |
| Firma remota de la contraparte | ⛔ **Bloqueada** — esperando respuesta del cliente |

**Lo hecho.** La rúbrica registrada del representante legal se estampa sobre la línea de firma, dentro del cuerpo del contrato. La hoja anexa pasó de ser un texto plano a una constancia con el hash del borrador y el del contrato. Las 17 plantillas activas quedaron preparadas.

Para que aparezca la firma, **alguien debe subir la imagen de la rúbrica** en la ficha de empresa (PNG con fondo transparente). Hoy no hay ninguna cargada: la de prueba se eliminó tras verificar.

**Lo que falta y por qué.** La firma remota depende de saber si la cuenta de Acrobat Sign de Incrementa permite conexión con otros sistemas (API). Es la única definición que bloquea, y bloquea todo lo que queda de la firma: sin esa respuesta no se puede decidir si se integra con Adobe o se construye un portal propio, y el modelo de datos de la bitácora depende de esa elección.

**Consulta enviada:** mensaje de WhatsApp redactado pidiendo el plan de Acrobat Sign. *(Confirmar si se envió.)*

---

## Tema 2 — Contrato de empresa con boost (CONTRATO_0002)

Reportado por WhatsApp el **14 de agosto**. Dos observaciones sobre un contrato de prueba para Chantal Universe Glow SpA, cliente Laboratorio Chile.

### 2.1 — Ingresó el producto "Solbiot" y el contrato salió con "Dryoff"

**Qué pasó.** El borrador guardó `client_product_campaign = "DRYOFF"`. El PDF imprimió fielmente lo recibido: el valor equivocado entró **al generar**, no al renderizar. Laboratorio Chile tiene exactamente dos productos en catálogo: `DRYOFF` y `Solbiot`. El contrato lo generó el actor MCP, o sea por conversación con el agente, que eligió mal entre dos opciones.

**Causa de fondo.** El campo estaba declarado como lista cerrada, pero el backend aceptaba cualquier valor y lo imprimía. Mismo patrón que ya se había corregido para el correo: validación declarada para la interfaz, no exigida en el servidor.

**Qué se hizo.** Change `validar-campos-select`, desplegado el 4 de septiembre:

- Todo campo de lista cerrada se valida contra su catálogo, por interfaz web y por conversación. Comparación exacta a propósito — `Dryoff` y `DRYOFF` son entradas distintas, y normalizar escondería el error.
- Se validan también los pares red social / cuenta, para que no se crucen.
- Al agente le quedó **prohibido** elegir por cuenta propia cuando hay más de una opción, inferir la elección del contexto, o mapear a la opción más parecida. Y antes de emitir debe listar todos los valores y esperar confirmación.

**Nota:** la validación de catálogo por sí sola no habría bloqueado su PDF, porque "DRYOFF" sí estaba en el catálogo. Ver **2.1-bis**, que corrige este punto: la otra mitad del change sí lo habría evitado. La defensa de fondo sigue siendo que el contrato nace como borrador y una persona lo revisa antes de firmarlo — que es exactamente lo que ella hizo.

**Dato tranquilizador:** ese contrato quedó en estado borrador, sin firmar. No salió a ninguna parte.

**Auditoría de cierre.** Se revisaron los 30 borradores del sistema: un solo caso con un valor fuera de catálogo, de mayo, por deriva del catálogo del cliente. No es defecto.

### 2.1-bis — Evidencia posterior: la transcripción del chat (revisada el 4-sep)

Se recuperó la conversación que produjo ese contrato. **Cambia el diagnóstico.**

Marcela entregó los datos escribiendo **"Marca: Solbiot"**. El sistema tiene dos campos distintos:

| Campo | Etiqueta en el sistema | De dónde salió |
|---|---|---|
| `client_brand` | **Marca** | de la ficha del cliente → *Laboratorio Chile* |
| `client_product_campaign` | **Producto/Campaña** | lista cerrada → *DRYOFF* o *Solbiot* |

El agente interpretó "Solbiot" como marca en su resumen en prosa, pero ese campo ya venía resuelto desde la ficha del cliente. El campo que sí requería valor —Producto/Campaña— quedó sin dato, y **el agente lo llenó por su cuenta con la otra opción del catálogo**.

**Verificado en el PDF:** "Solbiot" aparece **0 veces**; "DRYOFF" 10 veces. El dato que ella entregó no fue reemplazado, fue **descartado**.

El agente lo declaró en su resumen —*"marca Solbiot (campaña DRYOFF)"*— pero **después** de generar el PDF, no antes de hacerlo.

**Corrección respecto de lo anotado antes.** Se había registrado que el arreglo no habría evitado su caso. Eso vale solo para la validación de catálogo del backend. La otra mitad del change —prohibir que el agente elija por cuenta propia cuando hay más de una opción, y exigir confirmación **antes** de generar— **sí lo habría evitado**: habría tenido que preguntarle cuál de los dos productos.

### 2.2 — Algunas enumeraciones en negrita y otras no

**Qué se encontró.** El defecto era más acotado de lo que parecía: de 27 numeraciones tipo `N.N` en CONTRATO_0002, **26 estaban en negrita y una no — la 7.2**. El relevamiento sobre las 17 plantillas activas mostró el mismo caso único en **9 de ellas** (CONTRATO_0001 a 0009). Las 0010 a 0017 estaban correctas.

Delata linaje: las nueve primeras se derivaron de un ancestro común que traía el error.

**Qué se hizo.** Corregido en las 9, con respaldo previo. Verificado renderizando antes y después: el texto extraído es idéntico, solo cambió el formato.

### 2.2-bis — Verificación completa de la numeración (4-sep)

Marcela envió una captura mostrando `7.1` en negrita y `7.2` sin negrita, y pidió revisar que todos los números estuvieran en negrita. La captura es el mismo defecto del 2.2, ya corregido — pero su pregunta motivó un barrido más amplio, porque el de ayer solo cubrió el patrón `N.N`.

**Resultado sobre las 17 plantillas activas:**

| Patrón | En negrita | Sin negrita |
|---|---|---|
| `N.N` (7.1, 14.1...) | **592** | **0** |
| Encabezados (`SÉPTIMO`, `DÉCIMOCUARTO`) | **193** | **0** |
| `(i)`, `(ii)` dentro de frases | — | 2 — correcto así, no son cláusulas |

**Defecto adicional encontrado y corregido.** CONTRATO_0017 tenía la cláusula escrita como `"14. 1 Para la interpretación..."`, con un espacio de más entre el 14 y el 1, y sin negrita. El barrido anterior no la detectó justamente por ese espacio: no calzaba con el patrón `N.N`. Corregida a `14.1` en negrita, con respaldo (`pre-correccion-numeracion-espaciada`) y verificando que el único cambio de texto fuera el espacio eliminado.

**IMPORTANTE para la respuesta.** Los contratos **ya generados conservan el formato con que se emitieron**. Si Marcela vuelve a abrir el mismo PDF, va a seguir viendo la 7.2 sin negrita y va a pensar que no se arregló. Hay que decírselo explícitamente y pedirle que genere uno nuevo para comprobarlo.

---

### 2.3 — Hallazgo nuevo: choque de vocabulario (sin resolver)

El sistema llama **"Marca"** al cliente (Laboratorio Chile) y **"Producto/Campaña"** a Solbiot. Marcela llama "marca" a Solbiot.

Mientras las etiquetas digan eso, va a seguir entregando el dato bajo el nombre equivocado — y no solo por conversación: en el formulario web le pasaría lo mismo.

**No lo arregla ninguna validación.** Es nomenclatura, y hay que decidirla con ella: qué palabra usa el negocio para cada concepto. Pendiente de conversar.

---

## Tema 3 — Un contrato con dos redes sociales (CONTRATO_0014)

**Qué pasó.** Marcela pidió 3 reels en Instagram **y** 3 videos en TikTok. El agente se detuvo y le ofreció tres salidas: dos contratos separados, texto libre en un campo, o solo Instagram por ahora. **Las tres son malas** — y que se detuviera a preguntar fue lo correcto: le pidieron representar dos entregables en un modelo que admite uno.

**Dónde está el problema.** En la cláusula **2.3** de la plantilla, que describe el entregable con tres variables en singular:

```
2.3  ...la generación y publicación de {{cantidad_reels}} {{formato_reel}}
     en el perfil de {{proveedor_red_social}} del Influencer...
```

Arrastra a la **2.5**, que nombra una sola cuenta de publicación y se declara a sí misma "elemento esencial del acuerdo". Ninguna otra cláusula depende de la red social.

**Por qué no se parametriza.** No es un problema de variables sino de **estructura**: con dos entregables cambia el texto escrito a mano alrededor — conectores, comas, concordancia de plural. Agregar campos no alcanza.

**Por qué las opciones del agente no sirven:**

- *Dos contratos separados* — el precio es uno solo por el paquete; partirlo obliga a inventar un reparto que no existe en el acuerdo y queda en una boleta de honorarios. Además duplica cesión, exclusividad y boost, con riesgo de obligaciones contradictorias.
- *Texto libre* — rompe el modelo (`cantidad_reels` es numérico y `formato_reel` concuerda con él), y la validación de catálogo desplegada el 4-sep **ya lo rechaza**.
- *Solo una red por ahora* — posterga, y deja a la influencer obligada a la mitad del trato.

**Opciones planteadas a Marcela:** (A) que el sistema componga la frase — rápido, pero la redacción de una cláusula esencial se muda al código y ella pierde el control desde el editor de plantillas; (B) un **anexo de entregables** al que la 2.3 remite, generado como lista. Se recomienda **B**: no resuelve el problema de concordancia, lo elimina — una lista se lee igual con uno o con cinco ítems, es la solución legal estándar, el motor ya renderiza listas, y de paso arregla la 2.5.

**Estado:** ⛔ **esperando definición de Marcela.** Nada implementado.

> **Ampliado por el [Tema 5](#tema-5--contratos-por-evento-el-alcance-del-multi-red-es-más-amplio-22-sep) (22-sep):** el alcance no es solo la 2.3 — los contratos por evento impactan también la 2.1 y la 2.2, y lo multi-red puede darse fuera de los contratos por evento.

### Hallazgo colateral — red social escrita a mano (sin resolver)

Independiente del multi-red: **las 17 plantillas tienen "Instagram" escrito a mano en la cláusula 2.5**, junto a la variable de la cuenta. Un contrato solo de TikTok ya sale hoy diciendo *"deberá publicar el contenido en Instagram a través de su cuenta @sucuentadetiktok"*. Y esa cláusula se declara esencial.

Es un defecto **activo**, no hipotético, y probablemente ya afectó contratos. Se puede corregir por separado y antes que el multi-red.

**Estado: postergado por decisión del usuario (4-sep).** No volver a proponerlo hasta que él lo retome. Queda anotado acá para no perderlo, y conviene resolverlo junto con el Tema 3 si se va por la opción del anexo, porque esa reescribe la 2.5 de todas formas.

---

## Tema 4 — El sistema no acepta el RFC de una proveedora mexicana (CONTRATO_0016)

**Qué pasó.** Marcela intentó cargar a Francisca Elena Leos García con su RFC `LEGF870121MGA` para generar un contrato con CONTRATO_0016, de jurisdicción mexicana. El sistema respondió *"El RUT ingresado no es válido"* y ella abandonó ese contrato.

**Qué se encontró — eran tres capas, no una validación mal puesta:**

1. `parseRut` es estrictamente chileno: 7-8 dígitos y dígito verificador módulo 11. El RFC se reduce a 6 dígitos al quitarle las letras y falla.
2. El esquema **no podía contenerlo**: `rut_body` y `rut_dv` eran NOT NULL y modelan un RUT descompuesto en cuerpo + dígito verificador. Un RFC es alfanumérico de 13 caracteres y no se descompone así — su homoclave final cumple la función de verificador pero es parte del identificador.
3. La plantilla mexicana decía **"cédula de identidad"**, copiada de la chilena. Aunque se arreglaran 1 y 2, el contrato habría salido mal redactado.

De fondo: el sistema se construyó para Chile y después se le agregaron plantillas mexicanas sin un modelo de datos internacional.

**Qué se hizo.** Change `identificador-tributario-por-pais`, desplegado el 4 de septiembre:

- El proveedor ahora tiene **país**, y su identificador es **tipo + número** resueltos contra un catálogo. Agregar Argentina o Colombia pasa a ser cargar una fila, no escribir código.
- Chile conserva íntegra su validación módulo 11 y su formato `XX.XXX.XXX-X`.
- El formulario adapta la etiqueta según el país: **RUT** para Chile, **RFC** para México, cada uno con su ejemplo.
- **Coherencia país–plantilla**: generar una plantilla chilena para un proveedor mexicano ahora se rechaza nombrando ambos países. Antes nada lo impedía y el contrato habría salido con la jurisdicción equivocada.
- Las plantillas 0016 y 0017 dejaron de llamar "cédula de identidad" al RFC.

**Verificado:** alta mexicana con `LEGF870121MGA` por la interfaz; listado y Constructor de documento mostrando el RFC íntegro junto a los RUT chilenos formateados; los 22 proveedores chilenos con su identificador **idéntico** al de antes del cambio, contrastado contra un listado capturado previamente.

**Estado:** ✅ **resuelto y desplegado. Nada que consultarle** — solo avisarle que ya puede reintentar ese contrato.

### Hallazgos colaterales (sin resolver, no bloquean)

**La moneda.** CONTRATO_0016 es en dólares (`$290 USD`) y el precio se formatea con separador de miles chileno y signo `$`. Es la misma fuga de locale por otro lado, y hoy es lo único que separa a México de estar realmente soportado. Merece su propio change.

**El RUT que se autocorrige.** Detectado al probar, y **preexistente**: `parseRut('12.345.678-9')` devuelve `ok` con `dv=5`. El sistema no rechaza un dígito verificador equivocado, lo **reemplaza en silencio**. Un dedazo produce un RUT distinto del que se escribió, y ese RUT sale impreso en un contrato. Es el mismo patrón del Tema 2.1: el sistema decide por el usuario en vez de preguntar. Sin change asignado.

---

## Tema 5 — Contratos por evento: el alcance del multi-red es más amplio (22-sep)

**De dónde sale.** Apuntes de la reunión con Marcela del 22 de septiembre. Amplía el **Tema 3**: el problema no es solo "dos redes sociales en la 2.3".

**Lo que dijo.**

- Hay **cinco tipos de contrato que son por evento**. Cuando el contrato es por evento, se ven impactadas **tres cláusulas: 2.1, 2.2 y 2.3**.
- **Cláusula 2.1 — se especifica el evento en sí mismo.** En el contrato de ejemplo que entregó: el evento, la fecha (27 de mayo), la hora (18:30) y el lugar. *(Nombres del evento y del recinto por confirmar contra el contrato de ejemplo; los apuntes vienen de una transcripción.)*
- **Cláusula 2.2 — más de una red social y más de una cantidad de reels.** Marcela precisó que esto **puede ocurrir aunque el contrato no sea por evento**: un proveedor, persona o empresa puede entregar su servicio en varias redes y con varias cantidades.
- **Cláusula 2.3 — el contenido del servicio**, que también puede ser más de uno y en más de una red social.

**Qué cambia respecto del Tema 3.** El Tema 3 estaba planteado sobre la 2.3 y su arrastre a la 2.5. Ahora son al menos **cuatro cláusulas** (2.1, 2.2, 2.3 y 2.5) y aparece una dimensión nueva, el **evento**, que no estaba en el análisis.

**Pendiente de recabar:** el contrato de ejemplo con evento, y cuáles son los cinco tipos de contrato por evento (¿son 5 de las 17 plantillas activas? ¿cuáles?).

**Estado:** ⛔ **sin analizar.** No hay diseño ni estimación; hay que rehacer el análisis del Tema 3 con este alcance.

---

## Temas siguientes

*(pendientes de registrar)*

---

## Para la respuesta consolidada

Puntos a cubrir cuando se le escriba:

- Tema 1: la firma de la empresa ya sale escrita; hay que subir la imagen de la rúbrica; la firma de la influencer espera la definición de Acrobat Sign.
- Tema 2.1: corregido. Su dato ("Solbiot") fue descartado, no reemplazado: el agente llenó solo un campo obligatorio de lista cerrada. Ahora tiene prohibido elegir sin preguntar y debe confirmar los valores antes de emitir.
- Tema 2.3: preguntarle qué palabra usa el negocio para cada concepto — hoy "Marca" en el sistema es el cliente, no el producto, y ahí se originó la confusión.
- Tema 2.2: corregido en las 9 plantillas que lo tenían, más una cláusula mal numerada en CONTRATO_0017. Barrido completo: 592 numeraciones y 193 encabezados, ninguno sin negrita.
- **Avisarle que los PDF ya generados conservan el formato viejo**: tiene que generar uno nuevo para ver la corrección.
- Tema 3: **incluir la pregunta redactada** sobre cómo resolver el multi-red (opción A vs anexo), más las tres consultas: precio único o por red, alcance del boost/exclusividad, y frecuencia del caso multi-red.
- Tema 3 colateral: el "Instagram" escrito a mano en la 2.5 quedó **postergado**; no incluirlo en la respuesta salvo que el usuario lo reactive.
- Tema 4: resuelto. Avisarle que ya puede reintentar el contrato mexicano; el sistema acepta RFC y adapta el formulario según el país. No requiere respuesta suya.
- Recordar que revisar el borrador antes de firmar es parte del diseño, y que su revisión funcionó.
