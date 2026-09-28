## Context

`cd frontend && npm run lint` (ESLint, `frontend/eslint.config.js`) falla con 38 errores y 13 avisos de `react-hooks/exhaustive-deps`. El lint salió de las pruebas del perfil de AOD mientras siga así. El comportamiento de la aplicación no puede cambiar: reescribir efectos, mover helpers fuera de los archivos de componentes o tocar las expresiones de `sanitizePastedPlainText` queda fuera.

`eslint.config.js` ya apaga `react-hooks/set-state-in-effect` en `DashboardPage.jsx` con un comentario. `no-unused-vars` está en `['error', { varsIgnorePattern: '^[A-Z_]' }]`. No está `eslint-plugin-react`, así que ESLint no cuenta un identificador usado solo en JSX. `package.json` no se modifica.

La consulta C-SU4NYYK corrigió el encargo: `navIcon` en `AppSubHeader.jsx` sí se renderiza (`<navIcon.Component />`, hoy línea 77). No se borra.

## Goals / Non-Goals

**Goals:**

- `npm run lint` en `frontend/` termina con 0 errores y los mismos 13 avisos de `exhaustive-deps`, sin avisos nuevos.
- El código que no se lee se borra, junto con los imports que queden huérfanos.
- Las excepciones de ESLint quedan acotadas: tres archivos, los tests, `ignoreRestSiblings`, y desactivaciones por línea con motivo en español.
- `sanitizePastedPlainText` sigue haciendo lo mismo, y un archivo de prueba nuevo fija el trato de los caracteres de control.

**Non-Goals:**

- Corregir los 13 avisos de `react-hooks/exhaustive-deps`.
- Reescribir efectos, mover funciones entre archivos, renombrar exportaciones o cambiar lógica.
- Tocar archivos de prueba existentes, `package.json`, el backend, `openspec/config.yaml`, `docs/**` o `.agent-orchestrator/**`.
- Volver a poner `npm run lint` en el perfil de AOD.

## Decisions

### D1 — Cuatro mecanismos, nada de lógica

1. Borrar bindings que solo aparecen en su declaración, y los imports que queden sin uso.
2. Tres ajustes en `eslint.config.js`.
3. `// eslint-disable-next-line <regla> -- <motivo en español>` en la línea que marca ESLint. Nunca un `eslint-disable` de archivo, y nunca sin motivo.
4. Renombrar el binding local `navIcon` a `NavIcon`. No es código muerto.

Si al borrar un binding la línea que hay que desactivar se corre, el comentario va en la línea que marque ESLint, en el mismo bloque.

### D2 — `react-refresh/only-export-components` solo en tres archivos

Bloque nuevo, al lado del de `DashboardPage.jsx`, con la regla en `'off'` para:

- `src/pages/SupplierFormSections.jsx`
- `src/pages/ClientFormSections.jsx`
- `src/pages/DocumentBuilderPage.jsx`

Comentario del bloque: `// Exportan funciones que importan las pruebas existentes; la regla solo afecta el HMR de Vite.`

Mover esas funciones rompería pruebas existentes (`SupplierFormSections.contact.test.jsx`, `SocialNetworkSelector.test.jsx`, `DocumentBuilderPage.test.jsx`), y esos archivos no se tocan.

### D3 — Globales de Node solo en pruebas

`src/components/RichTextEditor/styles.module.css.test.js` usa `process` y no se modifica. Un bloque `files: ['**/*.test.{js,jsx}']` agrega `globals.node` a los globales. El archivo de prueba sigue igual.

### D4 — `ignoreRestSiblings` para el resto que sí se usa

En la regla `no-unused-vars`, el objeto pasa a `{ varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }`. Eso cubre `const { product_campaigns, ...rest }` en `ClientUpsertPage.jsx` y `const { social_networks, ...rest }` en `SupplierUpsertPage.jsx`. Esas líneas no se editan.

### D5 — Borrar solo lo que no se lee

| Binding | Dónde | Qué se borra |
|---|---|---|
| `profile`, `enrichedCompany` | `CompaniesViewPage.jsx`, `CompanyEditLayout.jsx` | Las dos asignaciones. Aparecen solo ahí. |
| imports `selectEnrichedProfile`, `selectEnrichedCompany` | los mismos dos archivos | El import de `authSlice` completo: no queda otro uso. |
| `useSelector` | los mismos dos archivos | El import de `react-redux`: no queda otro uso. Las llamadas se van con las asignaciones. |
| `companyId` | `DocumentBuilderPreviewPage.jsx` | Solo esa clave de la desestructuración de `usePlatformAdminCompanyScope()`. La llamada al hook se queda. |
| `e` | el `catch` de `materializeTemplateDocClient` en el mismo archivo | `catch (e)` pasa a `catch`. El cuerpo no usa el error. |
| `supplierTypeLabel` | `SupplierFormSections.jsx` | La función entera. No se exporta y no se llama. |

Los selectores borrados no alimentan el render ni ningún efecto. Quitar la suscripción no cambia lo que la página muestra.

### D6 — `navIcon` se renombra a `NavIcon`

En `AppSubHeader.jsx`:

- `const navIcon = getSidebarIconForNavItem(...)` pasa a `const NavIcon = getSidebarIconForNavItem(...)`.
- `<navIcon.Component />` pasa a `<NavIcon.Component />`.
- El import de `getSidebarIconForNavItem` se queda.

`varsIgnorePattern: '^[A-Z_]'` ya ignora ese nombre, así que el falso positivo desaparece sin desactivar la regla y sin agregar `eslint-plugin-react`. El valor que se renderiza es el mismo.

### D7 — Desactivación por línea, con el motivo fijado

El comentario va en la línea anterior a la que marca ESLint (`eslint-disable-next-line`). Motivos:

| Archivo | Regla | Motivo |
|---|---|---|
| `src/components/ConfirmDialog.jsx` | `react-hooks/set-state-in-effect` | `limpia la posición anclada cuando el diálogo se cierra` |
| `src/components/DateInputCL.jsx` | `react-hooks/set-state-in-effect` | `sincroniza el texto visible cuando cambia el valor externo` |
| `src/components/RichTextEditor/VariableCatalog.jsx` | `react-hooks/set-state-in-effect` | `recalcula la lista filtrada al cambiar la búsqueda o el grupo` |
| `src/components/StandardTemplateEditor.jsx` | `react-hooks/set-state-in-effect` | `fija la línea base de cambios al terminar de cargar en modo crear` |
| `src/pages/DocumentBuilderPage.jsx` | `react-hooks/set-state-in-effect` | `reinicia el dry run cuando faltan datos para consultarlo` |
| `src/pages/RoleDetailPage.jsx` (efecto que llama `loadRole`) | `react-hooks/set-state-in-effect` | `carga el rol al montar, como las demás páginas de detalle` |
| `src/pages/RoleDetailPage.jsx` (`useCallback` de `loadRole`) | `react-hooks/preserve-manual-memoization` | `useCallback deliberado: loadRole se reutiliza después de guardar` |
| `src/utils/sanitizePastedPlainText.js` (clase `[​-‏…]` con U+034F) | `no-misleading-character-class` | `elimina a propósito caracteres invisibles, incluido el combinante U+034F` |
| `src/utils/sanitizePastedPlainText.js` (clase de controles) | `no-control-regex` | `elimina a propósito los caracteres de control de un texto pegado` |

`DateInputCL.jsx` ya tiene un `eslint-disable-line` de `exhaustive-deps` en el array de dependencias. Ese comentario se queda. El nuevo va aparte, sobre la línea del `setDisplay`.

Las dos expresiones regulares no se modifican.

### D8 — Pruebas nuevas, archivo nuevo

`frontend/src/utils/sanitizePastedPlainText.controlChars.test.js` importa `sanitizePastedPlainText` y afirma el comportamiento de hoy:

- `'a\u0000b\u0007c\u001Fd\u007Fe'` → `'abcde'`. Esos cuatro caen en el reemplazo de controles, que corre después de convertir `\v` y `\f`.
- Un texto con `\n`, `\v` y `\f` conserva el `\n` y convierte `\v` y `\f` en `\n` (ese reemplazo está antes del de controles).
- Un texto sin caracteres especiales sale igual. `trim()` final no lo altera si no hay espacios en los extremos.

No se edita `sanitizePastedPlainText.test.js` ni ningún otro archivo de prueba.

## Risks / Trade-offs

- [ESLint marca otra línea tras borrar código] → El comentario va en la línea que marque ESLint, dentro del mismo bloque, con el mismo motivo.
- [Quitar `useSelector` deja de re-renderizar esas páginas cuando cambia el perfil enriquecido] → El valor no se leía. El render y los efectos no dependen de él. Si una prueba existente falla por eso, no se ajusta: se consulta a la mesa.
- [Un `catch` sin binding oculta el error en depuración] → El cuerpo ya no usa `e`. El mensaje al usuario sigue siendo el mismo.
- [Apagar `only-export-components` en tres archivos] → El HMR de Vite puede no recargar fino ahí. Es el mismo criterio que ya se aceptó para no mover helpers que las pruebas importan.
- [`ignoreRestSiblings` esconde un resto que de verdad sobra] → Solo aplica al sibling omitido en un rest. El resto de `no-unused-vars` sigue en error.

## Migration Plan

No hay migración ni cambio de datos. El despliegue es el del frontend. Rollback: revertir los archivos de esta corrida. No hay estado nuevo que deshacer.

## Open Questions

Ninguna. C-SU4NYYK quedó resuelta: `navIcon` se renombra a `NavIcon` y no se borra.
