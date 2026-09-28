# Recorte · lint-frontend-cero

> Encargo de Ignacio (arquitecto), 28-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/lint-frontend.md`.

## 1. Objetivo

`cd frontend && npm run lint` falla hoy con 38 errores. Al terminar, **termina sin errores**. Los 13
avisos de `react-hooks/exhaustive-deps` pueden seguir, pero no puede aparecer ningún aviso nuevo, y
**el comportamiento de la aplicación no cambia**.

## 2. Arquitectura

Solo tres tipos de cambio, cada uno donde lo indica la sección 3:

1. **Borrar código muerto** (variables, asignaciones y funciones sin uso, más los imports que queden
   sin uso por eso).
2. **Ajustar `frontend/eslint.config.js`** (dos cambios, detallados abajo).
3. **Comentarios de desactivación por línea**, siempre
   `// eslint-disable-next-line <regla> -- <motivo en español>`. Nunca un `eslint-disable` de archivo
   completo, y nunca sin motivo.

Nada más: no se reescriben efectos, no se mueven funciones entre archivos, no se renombra nada que
se exporte y no se cambia ninguna lógica.

## 3. Los 38 errores, uno por uno

### `react-refresh/only-export-components` (18): configuración

En `frontend/eslint.config.js`, un bloque nuevo (como el que ya existe para `DashboardPage.jsx`)
para `src/pages/SupplierFormSections.jsx`, `src/pages/ClientFormSections.jsx` y
`src/pages/DocumentBuilderPage.jsx`, con la regla en `'off'` y este comentario:
`// Exportan funciones que importan las pruebas existentes; la regla solo afecta el HMR de Vite.`

### `no-undef` (1): configuración

`src/components/RichTextEditor/styles.module.css.test.js` usa `process`. En `eslint.config.js`, un
bloque para `**/*.test.{js,jsx}` que agregue `globals.node` a los globales. **No toques el archivo de
prueba.**

### `no-unused-vars` (10)

- En la regla de `eslint.config.js`, agrega `ignoreRestSiblings: true` a
  `{ varsIgnorePattern: '^[A-Z_]' }`. Eso resuelve `product_campaigns` (`ClientUpsertPage.jsx:55`) y
  `social_networks` (`SupplierUpsertPage.jsx:147`), que son el patrón
  `const { campo, ...rest } = obj`. No toques esas líneas.
- Borra:
  - `navIcon` en `src/layout/AppSubHeader.jsx:48`: la asignación completa, incluida la llamada a
    `getSidebarIconForNavItem`, y su import si queda sin uso;
  - `profile` y `enrichedCompany` en `src/pages/CompaniesViewPage.jsx:18-19` y en
    `src/pages/CompanyEditLayout.jsx:16-17`, y los imports de `selectEnrichedProfile` y
    `selectEnrichedCompany` si quedan sin uso;
  - `companyId` en la desestructuración de `src/pages/DocumentBuilderPreviewPage.jsx:36` (el resto
    de la desestructuración queda);
  - la función `supplierTypeLabel` en `src/pages/SupplierFormSections.jsx:114`.
- En `src/pages/DocumentBuilderPreviewPage.jsx:88`, `catch (e)` pasa a `catch`, sin el parámetro.

### `react-hooks/set-state-in-effect` (6) y `react-hooks/preserve-manual-memoization` (1): desactivación por línea

Pon el comentario en la línea que marca ESLint, con el motivo que corresponda:

| Archivo:línea | Regla | Motivo |
|---|---|---|
| `src/components/ConfirmDialog.jsx:38` | `react-hooks/set-state-in-effect` | `limpia la posición anclada cuando el diálogo se cierra` |
| `src/components/DateInputCL.jsx:15` | `react-hooks/set-state-in-effect` | `sincroniza el texto visible cuando cambia el valor externo` |
| `src/components/RichTextEditor/VariableCatalog.jsx:25` | `react-hooks/set-state-in-effect` | `recalcula la lista filtrada al cambiar la búsqueda o el grupo` |
| `src/components/StandardTemplateEditor.jsx:122` | `react-hooks/set-state-in-effect` | `fija la línea base de cambios al terminar de cargar en modo crear` |
| `src/pages/DocumentBuilderPage.jsx:296` | `react-hooks/set-state-in-effect` | `reinicia el dry run cuando faltan datos para consultarlo` |
| `src/pages/RoleDetailPage.jsx:64` | `react-hooks/set-state-in-effect` | `carga el rol al montar, como las demás páginas de detalle` |
| `src/pages/RoleDetailPage.jsx:38` | `react-hooks/preserve-manual-memoization` | `useCallback deliberado: loadRole se reutiliza después de guardar` |

Si en algún caso ESLint marca otra línea que la indicada (por ejemplo, porque el borrado de código
muerto corrió las líneas), usa la que marque ESLint, en el mismo bloque.

### `no-control-regex` y `no-misleading-character-class` (2): desactivación por línea

En `src/utils/sanitizePastedPlainText.js`:
- la línea 23 (`[​-‏…�]`): `no-misleading-character-class`, con el motivo
  `elimina a propósito caracteres invisibles, incluido el combinante U+034F`;
- la línea 26 (`[\u0000-\u0008…\u007F]`): `no-control-regex`, con el motivo
  `elimina a propósito los caracteres de control de un texto pegado`.

**Las expresiones regulares no cambian.**

## 4. Recomendaciones

- Corre `npx eslint .` al principio y al final, y compara: al final tiene que haber 0 errores y los
  mismos 13 avisos de `exhaustive-deps`.
- Si al borrar una variable queda un import sin uso, bórralo también. Si una llamada que ibas a
  borrar tiene efectos (no es pura), no la borres y consulta a la mesa.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/**`,
  `frontend/config.js`, `frontend/vite.config.js`, `.github/**`, `infra/**`,
  `.agent-orchestrator/**`.
- Las dependencias no cambian (`package.json` queda igual).
- Mensajes, comentarios y commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente**, tampoco para
resolver un error de lint (para eso está el bloque de configuración de la sección 3). Si cualquier
prueba existente falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en el archivo nuevo `frontend/src/utils/sanitizePastedPlainText.controlChars.test.js`**, porque
hoy nada prueba que se eliminen los caracteres de control:

- `sanitizePastedPlainText('a\u0000b\u0007c\u001Fd\u007Fe')` devuelve `'abcde'`.
- El salto de línea (`\n`) se conserva, y `\v` y `\f` se convierten en `\n`, como hoy.
- Un texto sin caracteres especiales sale igual.

Revisa en `sanitizePastedPlainText.js` el orden de los reemplazos y la exportación antes de escribir
las aserciones: las pruebas describen lo que hace **hoy**.

## 8. Puntos de atención

- `npm run lint` todavía no está en las pruebas del perfil. Tienes que correrlo tú; **el recorte
  está terminado solo cuando da 0 errores**.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las
  dos en verde.
