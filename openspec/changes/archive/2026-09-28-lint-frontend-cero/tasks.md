## 1. Configuración de ESLint

- [x] 1.1 Correr `cd frontend && npx eslint .` antes de editar y anotar los 13 avisos de `react-hooks/exhaustive-deps` (archivo y regla). Al final tienen que ser esos mismos y ningún aviso nuevo.
- [x] 1.2 En `frontend/eslint.config.js`, agregar un bloque para `src/pages/SupplierFormSections.jsx`, `src/pages/ClientFormSections.jsx` y `src/pages/DocumentBuilderPage.jsx` con `react-refresh/only-export-components` en `'off'` y el comentario `// Exportan funciones que importan las pruebas existentes; la regla solo afecta el HMR de Vite.`
- [x] 1.3 En el mismo archivo, agregar un bloque `files: ['**/*.test.{js,jsx}']` que sume `globals.node` a los globales. No modificar `src/components/RichTextEditor/styles.module.css.test.js`.
- [x] 1.4 En `no-unused-vars`, pasar las opciones a `{ varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }`. No editar las líneas de `product_campaigns` (`ClientUpsertPage.jsx`) ni de `social_networks` (`SupplierUpsertPage.jsx`).

## 2. Código muerto y el ícono del subheader

- [x] 2.1 En `src/layout/AppSubHeader.jsx`, renombrar `navIcon` a `NavIcon` en la asignación (`const NavIcon = getSidebarIconForNavItem(...)`) y en `<NavIcon.Component />`. Dejar el import de `getSidebarIconForNavItem`. No borrar la llamada.
- [x] 2.2 En `src/pages/CompaniesViewPage.jsx` y `src/pages/CompanyEditLayout.jsx`, borrar `profile` y `enrichedCompany`, el import de `selectEnrichedProfile` y `selectEnrichedCompany`, y el import de `useSelector` desde `react-redux`.
- [x] 2.3 En `src/pages/DocumentBuilderPreviewPage.jsx`, quitar `companyId` de la desestructuración de `usePlatformAdminCompanyScope()` (la llamada se queda) y cambiar `catch (e)` por `catch` en el bloque de `materializeTemplateDocClient`.
- [x] 2.4 En `src/pages/SupplierFormSections.jsx`, borrar la función `supplierTypeLabel`.

## 3. Desactivaciones por línea

El comentario es `// eslint-disable-next-line <regla> -- <motivo>`, en la línea que marque ESLint. Si un borrado corrió las líneas, usar la que marque ESLint en el mismo bloque. Sin `eslint-disable` de archivo.

- [x] 3.1 `react-hooks/set-state-in-effect` en `src/components/ConfirmDialog.jsx` (`limpia la posición anclada cuando el diálogo se cierra`), `src/components/DateInputCL.jsx` (`sincroniza el texto visible cuando cambia el valor externo`; el `eslint-disable-line` de `exhaustive-deps` se queda), `src/components/RichTextEditor/VariableCatalog.jsx` (`recalcula la lista filtrada al cambiar la búsqueda o el grupo`), `src/components/StandardTemplateEditor.jsx` (`fija la línea base de cambios al terminar de cargar en modo crear`), `src/pages/DocumentBuilderPage.jsx` (`reinicia el dry run cuando faltan datos para consultarlo`) y `src/pages/RoleDetailPage.jsx` en el efecto que llama `loadRole` (`carga el rol al montar, como las demás páginas de detalle`).
- [x] 3.2 `react-hooks/preserve-manual-memoization` en el `useCallback` de `loadRole` en `src/pages/RoleDetailPage.jsx` (`useCallback deliberado: loadRole se reutiliza después de guardar`).
- [x] 3.3 En `src/utils/sanitizePastedPlainText.js`, sin cambiar las expresiones: `no-misleading-character-class` en la clase de invisibles (`elimina a propósito caracteres invisibles, incluido el combinante U+034F`) y `no-control-regex` en la clase de controles (`elimina a propósito los caracteres de control de un texto pegado`).

## 4. Pruebas del saneo

Archivo nuevo. No modificar `sanitizePastedPlainText.test.js` ni ningún otro archivo de prueba existente.

- [x] 4.1 Crear `frontend/src/utils/sanitizePastedPlainText.controlChars.test.js` con tres casos de `sanitizePastedPlainText`: `'a\u0000b\u0007c\u001Fd\u007Fe'` devuelve `'abcde'`; `'línea\nvertical\vform\ffinal'` devuelve `'línea\nvertical\nform\nfinal'`; `'Contrato vigente'` devuelve `'Contrato vigente'`.
- [x] 4.2 Crear `frontend/src/layout/AppSubHeader.test.jsx` (archivo nuevo; no existe hoy), cubriendo el escenario «Subheader still renders the nav icon» de `specs/frontend-lint-clean/spec.md`: renderizar `AppSubHeader` (con `Provider`/store de `authSlice`, `MemoryRouter` y `ShellProvider`, como hace `DocumentBuilderPreviewPage.test.jsx`) con `enrichmentStatus: 'succeeded'` y una ruta que resuelva un `navMatch`, y afirmar sobre el DOM renderizado (por ejemplo con `createRoot`/`act`/`flushSync`, patrón ya usado en `SupplierFormSections.contact.test.jsx`) que el ícono se sigue montando después del renombre `navIcon` → `NavIcon`.

## 5. Verificación

- [x] 5.1 Correr `cd frontend && npx eslint .`: 0 errores y los mismos 13 avisos de `exhaustive-deps` anotados en 1.1, sin avisos nuevos.
- [x] 5.2 Correr `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las dos en verde. Si una prueba existente falla, no ajustarla: consultar a la mesa.
