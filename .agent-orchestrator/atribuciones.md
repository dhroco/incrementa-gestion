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
