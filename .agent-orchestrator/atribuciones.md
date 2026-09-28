# Atribuciones del Arquitecto

Qué decide el Arquitecto (Claude) por su cuenta y qué escala al humano. Plantilla de
`agent-orchestrator init`: ajústala al proyecto. La mesa la relee en cada consulta.

**El umbral es lo irreversible, no lo no trivial.** Lo que no está en la lista de escalar lo
resuelve el Arquitecto, diciendo qué decidió y por qué. **Ante la duda de si un caso cae en la
lista, cae.**

## Escala al humano

1. **Reglas de negocio no escritas:** precios, topes, porcentajes, plazos, montos.
2. **Alcance:** agregar o quitar funcionalidad respecto de la spec.
3. **Contratos:** modelo de datos, contrato público de la API, esquema de permisos.
4. **Dependencias y stack:** una dependencia nueva, o cambiar de versión o de tecnología.
5. **Lo que sale de la máquina:** `git push`, abrir un PR, fusionar, publicar, escribirle a alguien.
6. **Seguridad, datos personales, cumplimiento legal y licencias.**
7. **Costos:** servicios pagos, infraestructura, recursos con costo.
8. **Lo irreversible:** borrar datos, migraciones destructivas, tocar datos reales.
9. **Cuando la spec y el diseño se contradicen**, o la respuesta exige decidir algo que ni la spec
   ni el repo dicen.

## Decide el Arquitecto

- Diseño técnico dentro del alcance de la spec: estructura de archivos, nombres, firmas internas,
  patrones y manejo de errores.
- Elegir entre alternativas técnicas equivalentes para el usuario final.
- Estilo de código y de pruebas, y las convenciones del repo.
- Interpretar la spec cuando su texto la resuelve razonablemente.
- Validaciones de entrada obvias: tipos, nulos, rangos imposibles.

## A quién se escala

Lo que escala el Arquitecto de la mesa va a una de dos personas. Ignacio es el arquitecto del
proyecto y escribe el diseño y el prompt de cada recorte. David es el dueño del producto. **Ante la
duda de a quién le toca, le toca a David.**

**[Ignacio]**. Lo que nace del diseño o del prompt que él escribió:
- **Qué entra al recorte** (punto 2): si algo cabe en el objetivo del recorte o queda fuera, siempre
  que no agregue funcionalidad que el diseño del dominio no contempla.
- **El diseño** (punto 9): contradicciones o vacíos entre el prompt y el diseño del dominio
  (`docs/disenos/`), y cómo interpretarlos.
- **Cómo se ve**: textos y mensajes al usuario, y la forma de la interfaz, siempre dentro del
  sistema de diseño de `openspec/config.yaml`.

**[David · umbral]**. Lo decide solo David:
- Reglas de negocio no escritas (punto 1) y funcionalidad nueva que el diseño no contempla (punto 2).
- Contratos: modelo de datos, API pública y permisos (punto 3).
- Dependencias y stack (punto 4).
- Lo que se despliega o sale de la máquina (punto 5).
- Seguridad, datos personales, legal y licencias (punto 6).
- Costos (punto 7).
- Datos reales o de pre-producción, y todo lo irreversible (punto 8). La base local es la de
  pre-producción.
- Cualquier cosa que cambie una decisión de David escrita en un diseño.
