# Dominio · lint del frontend

> Diseño de Ignacio (arquitecto), 28-sep-2026.

## Qué es

`cd frontend && npm run lint` (ESLint, `frontend/eslint.config.js`) falla en `preprod` con
**38 errores** y 13 avisos (medido el 28-sep sobre `9a7adf2`). Por eso Pedro lo sacó de las pruebas
del perfil de AOD (`28cffe2`). Mientras siga así, una corrida puede agregar errores nuevos sin que
nada la detenga.

## Los 38 errores

| Regla | Cant. | Qué es | Cómo se corrige |
|---|---|---|---|
| `react-refresh/only-export-components` | 18 | `SupplierFormSections.jsx`, `ClientFormSections.jsx` y `DocumentBuilderPage.jsx` exportan funciones además del componente. Solo afecta el recargado en caliente (HMR) de Vite en desarrollo | **Configuración**: la regla se apaga para esos tres archivos, con comentario. Mover las funciones a otro módulo rompería las pruebas existentes que las importan desde ahí (`SupplierFormSections.contact.test.jsx`, `SocialNetworkSelector.test.jsx`, `DocumentBuilderPage.test.jsx`), y AOD no permite tocarlas |
| `no-unused-vars` | 10 | Variables sin uso; dos son el patrón `const { campo, ...rest } = obj` para quitar un campo | Se borra lo que no se usa, y `ignoreRestSiblings: true` en la regla |
| `react-hooks/set-state-in-effect` | 6 | `setState` dentro de un `useEffect` | **Comentario de desactivación por línea con el motivo**, como el precedente de `DashboardPage.jsx`. Reescribir los efectos cambia el comportamiento y queda fuera |
| `react-hooks/preserve-manual-memoization` | 1 | Aviso del React Compiler en `RoleDetailPage.jsx` | Igual: desactivación por línea con motivo |
| `no-control-regex` · `no-misleading-character-class` | 2 | `sanitizePastedPlainText.js` elimina caracteres de control e invisibles **a propósito** | Desactivación por línea con motivo |
| `no-undef` | 1 | `process` en una prueba que corre en Node (`styles.module.css.test.js`) | **Configuración**: globales de Node para `**/*.test.{js,jsx}` |

Los 13 avisos (`react-hooks/exhaustive-deps`) no hacen fallar el lint y quedan como están:
corregirlos cambia cuándo corren los efectos.

## Recortes

Uno: `lint-frontend-cero`, en `lint-frontend.recortes.yaml`. Cuando esté fusionado, Ignacio vuelve
a poner `cd frontend && npm run lint` en `.agent-orchestrator/perfil.yaml`, en un commit aparte.

## Qué queda fuera

- Los avisos de `exhaustive-deps`.
- Reescribir efectos, o mover funciones fuera de los archivos de componentes.
- El lint del backend (no tiene).
