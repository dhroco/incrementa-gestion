# Pendientes de tooling — Cursor y fábrica de desarrollo

> Backlog de **baja prioridad, no bloqueante**. Mejoras para cuando haya holgura.
> Registrado el 3 de septiembre de 2026.

## Contexto

Ese día se configuraron reglas de proyecto para Cursor en `.cursor/rules/`: cuatro archivos `.mdc`, dos con `alwaysApply: true` (`00-proyecto`, `30-gotchas`) y dos activados por globs (`10-frontend`, `20-backend`). Se validaron con la **técnica del canario** en Cursor 3.18.9 — una instrucción distintiva en el archivo y comprobar si el agente la obedece — y las cuatro cargan correctamente.

Eso cerró el problema de fondo: durante el `/opsx:apply`, el CLI de OpenSpec entrega `context = 0` y `rules = 0` (a diferencia de `proposal`, `design`, `specs` y `tasks`, que sí reciben el contexto y, en el caso de `design`, las 153 reglas del sistema de diseño). Las reglas de `.cursor/rules/` ahora suplen ese vacío durante la implementación.

Lo que sigue son los residuos de ese trabajo.

---

## 1. Hooks de Cursor (`.cursor/hooks.json`)

Cursor soporta hooks a nivel de proyecto que se ejecutan en etapas del agent loop. Dos usos concretos:

**(a) `afterFileEdit`** — correr `eslint` automáticamente sobre lo que Cursor modifica, en vez de descubrir los problemas en la revisión.

**(b) `sessionStart`** — dejar registro de la sesión. Hay que **probar si el payload incluye el modelo en uso**.

Por qué importa (b): hoy **no existe trazabilidad de qué modelo escribió qué**. Se verificó que las transcripciones en `~/.cursor/projects/<proyecto>/agent-transcripts/<uuid>/<uuid>.jsonl` guardan solo `text` y `tool_use` — **no guardan el modelo ni los `tool_result`**. Si el payload del hook trae el modelo, cierra ese agujero.

> Advertencia metodológica derivada de lo anterior: como no hay `tool_result` en las transcripciones, buscar un término ahí y no encontrarlo **no prueba** que Cursor no lo haya visto. Este error ya se cometió una vez (se concluyó erróneamente que Cursor no leía `openspec/config.yaml`).

## 2. MCP Server en Cursor

Cursor **no** tiene acceso al MCP de Incrementa Gestión: no existe `.cursor/mcp.json` ni `~/.cursor/mcp.json`.

**Está frenado a propósito.** El MCP de pre-prod hoy corre **sin autenticación**, así que configurarlo tiene implicancia de seguridad directa. Retomar **solo cuando el MCP tenga auth**.

Cuando se retome: va en `~/.cursor/mcp.json`, **fuera del repo y sin commitear**.

## 3. Habilitar un modelo económico en Cursor

El selector hoy ofrece Grok 4.6 High, Grok 4.5 High Fast, Claude Opus 5 High y GPT-5.6 Sol Medium — **ninguno barato**.

Vía **"Add Models"** conviene habilitar uno liviano para `/opsx:explore` y `/opsx:archive`, reservando los caros para `design` y `apply`, que es donde la calidad se paga sola.

Es **optimización de costo, no de calidad**. Hacerlo cuando haya volumen.

## 4. `.claude/` sin versionar

Existe en el repo desde el **6 de agosto de 2026** y nunca se commiteó. Está en tierra de nadie: ni en git ni en `.gitignore`.

Revisar qué contiene y decidir el destino: entra a git (si es configuración compartible del proyecto) o a `.gitignore` (si es estado local o contiene algo sensible).

## 5. Generalizar las reglas a los demás proyectos

El `.cursor/rules/` de hoy **se escribió a mano**, leyendo `openspec/config.yaml` y `CLAUDE.md` de este repo.

Para el objetivo de operar varias plataformas en paralelo hace falta una **forma repetible de derivar esas reglas del `config.yaml` de cada repo**, que ya es la fuente oficial de contexto y sistema de diseño.

**Esto no es configuración de Cursor: es diseño de la fábrica de desarrollo.** Tratarlo como tal — es el único de los cinco que escala más allá de este proyecto, y probablemente el de mayor retorno.

---

## Rutas útiles

```
Reglas de Cursor      .cursor/rules/*.mdc          (00-proyecto, 10-frontend, 20-backend, 30-gotchas)
Comandos y skills     .cursor/commands/, .cursor/skills/
Fuente oficial        openspec/config.yaml          contexto + sistema de diseño
Instrucciones Claude  CLAUDE.md                     Cursor NO lo lee
Transcripciones       ~/.cursor/projects/<proyecto>/agent-transcripts/
Modelo seleccionado   ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
                      → clave cursor/applicationOpenModelAppliedConfig
                      (registra la SELECCIÓN, no el modelo efectivo si hay reruteo a Auto)
```
