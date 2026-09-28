# frontend-lint-clean Specification

## Purpose
TBD - created by archiving change lint-frontend-cero. Update Purpose after archive.

## Requirements
### Requirement: Frontend lint exits without errors

`cd frontend && npm run lint` MUST finish with zero errors. It MUST report the same 13 `react-hooks/exhaustive-deps` warnings that exist before this change, and MUST NOT report any other warning.

#### Scenario: Lint reports no errors and the same warnings

- **WHEN** `npm run lint` runs in `frontend/` after this change
- **THEN** the process exits 0, reports 0 errors, and reports those 13 `react-hooks/exhaustive-deps` warnings and no new warning

### Requirement: Unused bindings are removed

The frontend MUST delete bindings that appear only in their own declaration, and any import that becomes unused because of that:

- `profile` and `enrichedCompany` in `src/pages/CompaniesViewPage.jsx` and `src/pages/CompanyEditLayout.jsx`, the imports of `selectEnrichedProfile` and `selectEnrichedCompany`, and the `useSelector` import from `react-redux` in those two files
- the `companyId` key in the destructure of `usePlatformAdminCompanyScope()` in `src/pages/DocumentBuilderPreviewPage.jsx` (the hook call MUST remain)
- the unused `catch` binding in that same file (`catch (e)` MUST become `catch`)
- the function `supplierTypeLabel` in `src/pages/SupplierFormSections.jsx`

`product_campaigns` in `src/pages/ClientUpsertPage.jsx` and `social_networks` in `src/pages/SupplierUpsertPage.jsx` MUST stay as rest-sibling omissions. Those lines MUST NOT be edited.

#### Scenario: Company pages drop unread selectors

- **WHEN** `CompaniesViewPage` and `CompanyEditLayout` are linted
- **THEN** they no longer declare `profile` or `enrichedCompany`, and they no longer import `selectEnrichedProfile`, `selectEnrichedCompany`, or `useSelector`

#### Scenario: Preview drops the unread company id

- **WHEN** `DocumentBuilderPreviewPage` is linted
- **THEN** it still calls `usePlatformAdminCompanyScope()`, it does not bind `companyId`, and the `catch` around `materializeTemplateDocClient` has no binding

#### Scenario: Rest siblings stay in source

- **WHEN** lint runs on `ClientUpsertPage.jsx` and `SupplierUpsertPage.jsx`
- **THEN** the `product_campaigns` and `social_networks` rest omissions are unchanged and are not reported as unused

### Requirement: Subheader icon binding is renamed

`src/layout/AppSubHeader.jsx` MUST NOT delete the icon binding. The local name MUST be `NavIcon` both in `const NavIcon = getSidebarIconForNavItem(...)` and in `<NavIcon.Component />`. The import of `getSidebarIconForNavItem` MUST remain. The rendered icon MUST be the same component that call returns.

#### Scenario: Subheader still renders the nav icon

- **WHEN** `AppSubHeader` renders a resolved nav match
- **THEN** it renders `<NavIcon.Component />` from `getSidebarIconForNavItem` and lint does not report `NavIcon` as unused

### Requirement: ESLint exceptions stay scoped

`frontend/eslint.config.js` MUST turn `react-refresh/only-export-components` off only for `src/pages/SupplierFormSections.jsx`, `src/pages/ClientFormSections.jsx`, and `src/pages/DocumentBuilderPage.jsx`, with the comment `Exportan funciones que importan las pruebas existentes; la regla solo afecta el HMR de Vite.`

Files matching `**/*.test.{js,jsx}` MUST receive Node globals (`globals.node`). `no-unused-vars` MUST keep `varsIgnorePattern: '^[A-Z_]'` and MUST set `ignoreRestSiblings: true`.

A suppression MUST be a line comment of the form `// eslint-disable-next-line <regla> -- <motivo en español>`. A file-level `eslint-disable` MUST NOT be added. The line is the one ESLint reports; if a deletion shifts it, the comment MUST stay on that reported line in the same block. The existing `exhaustive-deps` disable in `DateInputCL.jsx` MUST remain.

The line comments MUST cover, with these reasons:

- `ConfirmDialog.jsx`, `react-hooks/set-state-in-effect`: `limpia la posición anclada cuando el diálogo se cierra`
- `DateInputCL.jsx`, `react-hooks/set-state-in-effect`: `sincroniza el texto visible cuando cambia el valor externo`
- `VariableCatalog.jsx`, `react-hooks/set-state-in-effect`: `recalcula la lista filtrada al cambiar la búsqueda o el grupo`
- `StandardTemplateEditor.jsx`, `react-hooks/set-state-in-effect`: `fija la línea base de cambios al terminar de cargar en modo crear`
- `DocumentBuilderPage.jsx`, `react-hooks/set-state-in-effect`: `reinicia el dry run cuando faltan datos para consultarlo`
- `RoleDetailPage.jsx` effect that calls `loadRole`, `react-hooks/set-state-in-effect`: `carga el rol al montar, como las demás páginas de detalle`
- `RoleDetailPage.jsx` `useCallback` of `loadRole`, `react-hooks/preserve-manual-memoization`: `useCallback deliberado: loadRole se reutiliza después de guardar`
- `sanitizePastedPlainText.js` invisible-character class, `no-misleading-character-class`: `elimina a propósito caracteres invisibles, incluido el combinante U+034F`
- `sanitizePastedPlainText.js` control-character class, `no-control-regex`: `elimina a propósito los caracteres de control de un texto pegado`

#### Scenario: Component files that tests import stay in place

- **WHEN** lint runs on `SupplierFormSections.jsx`, `ClientFormSections.jsx`, and `DocumentBuilderPage.jsx`
- **THEN** `react-refresh/only-export-components` does not report those files, and their exported helpers stay in the same modules

#### Scenario: Node global in a test file

- **WHEN** lint runs on `src/components/RichTextEditor/styles.module.css.test.js`
- **THEN** `process` is defined and that test file is unchanged

#### Scenario: Intentional patterns are suppressed per line

- **WHEN** lint runs on the files listed above
- **THEN** each listed rule is silent on that line because of an `eslint-disable-next-line` comment that includes the Spanish reason, and no file-level disable was added

### Requirement: Application behavior stays the same

This change MUST NOT rewrite effects, move functions between files, rename an export, or change logic. The regular expressions in `sanitizePastedPlainText` MUST stay byte for byte. Existing test files MUST NOT be modified. `package.json` MUST stay the same.

#### Scenario: Sanitizer expressions are untouched

- **WHEN** the invisible-character and control-character replacements in `sanitizePastedPlainText` are compared with the version before this change
- **THEN** both expressions are identical
