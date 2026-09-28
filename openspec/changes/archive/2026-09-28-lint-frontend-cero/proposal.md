## Why

`cd frontend && npm run lint` falla con 38 errores (medido el 28-sep-2026 sobre `9a7adf2`). Por eso el lint salió de las pruebas del perfil de AOD: una corrida puede sumar errores nuevos sin que nada la detenga. Hay que dejarlo en cero ahora, sin cambiar lo que hace la aplicación, para que el lint pueda volver al perfil en un commit aparte.

## What Changes

- `cd frontend && npm run lint` termina con **0 errores**. Los 13 avisos de `react-hooks/exhaustive-deps` pueden seguir; no aparece ningún aviso nuevo.
- Tres tipos de cambio, más un renombre local: borrar código muerto (variables, asignaciones, funciones sin uso y los imports que queden huérfanos), tres ajustes en `frontend/eslint.config.js`, y comentarios `eslint-disable-next-line` por línea con motivo en español. Sin `eslint-disable` de archivo completo y sin motivo vacío.
- En `AppSubHeader.jsx`, `navIcon` no se borra: se renombra a `NavIcon` en la asignación y en `<NavIcon.Component />`. El import de `getSidebarIconForNavItem` se queda. ESLint no rastrea el uso en JSX; el patrón `varsIgnorePattern: '^[A-Z_]'` deja de marcar el nombre. El ícono del subheader sigue igual (consulta C-SU4NYYK).
- El comportamiento de la aplicación no cambia: no se reescriben efectos, no se mueven funciones entre archivos, no se renombra nada exportado y no se altera ninguna lógica. Las expresiones regulares de `sanitizePastedPlainText` quedan iguales.
- Pruebas nuevas, en un archivo nuevo, que fijan lo que `sanitizePastedPlainText` ya hace con los caracteres de control. Ningún archivo de prueba existente se modifica.

No entra: los avisos de `exhaustive-deps`, el lint del backend, dependencias (`package.json` igual), migraciones, y volver a poner `npm run lint` en `.agent-orchestrator/perfil.yaml` (eso lo hace el arquitecto cuando esto esté fusionado).

## Capabilities

### New Capabilities

- `frontend-lint-clean`: `npm run lint` del frontend termina sin errores y sin avisos nuevos; el código muerto se elimina y las excepciones de ESLint quedan acotadas, sin cambiar el comportamiento.
- `pasted-plain-text-control-chars`: `sanitizePastedPlainText` elimina los caracteres de control y trata saltos y tabulaciones como hoy; ese comportamiento queda cubierto por pruebas nuevas.

### Modified Capabilities

_(ninguna)_

## Impact

**Frontend:** `frontend/eslint.config.js` y los archivos de producto que hoy fallan el lint (`AppSubHeader.jsx`, `CompaniesViewPage.jsx`, `CompanyEditLayout.jsx`, `DocumentBuilderPreviewPage.jsx`, `SupplierFormSections.jsx`, `ConfirmDialog.jsx`, `DateInputCL.jsx`, `VariableCatalog.jsx`, `StandardTemplateEditor.jsx`, `DocumentBuilderPage.jsx`, `RoleDetailPage.jsx`, `sanitizePastedPlainText.js`). Pruebas nuevas en `frontend/src/utils/sanitizePastedPlainText.controlChars.test.js`. `src/components/RichTextEditor/styles.module.css.test.js` no se toca: el `no-undef` de `process` se resuelve en la configuración.

**Backend:** ninguno.

**APIs y datos:** sin endpoints, contratos, migraciones ni seeds. Las dependencias no cambian.

**Verificación:** `cd frontend && npx eslint .` al inicio y al final (0 errores, los mismos 13 avisos). `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test` en verde.

## Consideraciones de seguridad

El cambio no abre rutas, no toca autenticación ni autorización, y no altera qué se persiste. El texto pegado en el editor puede traer contenido de un contrato; las expresiones que lo sanean se dejan igual, solo se documenta por qué ESLint las marca.

- Borrar código muerto no ejecuta efectos nuevos ni deja de ejecutar los que ya corrían. `navIcon` sí se usa en el JSX: se renombra, no se borra. `profile`, `enrichedCompany`, `companyId` y `supplierTypeLabel` aparecen solo en su declaración.
- Los comentarios de desactivación son por línea y con motivo. No se apaga una regla para todo el proyecto salvo los dos bloques de configuración ya acotados (tres archivos de componentes que exportan helpers de prueba, y globales de Node en `**/*.test.{js,jsx}`).
- Sin mensajes de error nuevos. Los que ya ve el usuario siguen en español (`es-CL`).
