# Decisiones del cambio lint-frontend-cero

Registro automático de la mesa de consultas.

## C-SU4NYYK · En AppSubHeader.jsx, ESLint marca `navIcon` (línea 48) como no usada, pero la línea 77 renderiza `<navIcon.Component />`. ¿La borro igual, o la dejo y apago el aviso por línea?

- **Preguntó:** Cursor
- **Decidió:** Ignacio
- **Revisión humana:** pendiente. Si discrepas, devuélvelo en «confirmar cierre».
- **Respuesta:** Tienes razón, fue un error del prompt: navIcon sí se usa en la línea 77 (<navIcon.Component />) y ESLint no lo ve porque no rastrea usos en JSX. NO lo borres. Renómbralo a NavIcon en las dos líneas (48: const NavIcon = getSidebarIconForNavItem(...), y 77: <NavIcon.Component />). La regla no-unused-vars ya ignora los nombres que empiezan con mayúscula (varsIgnorePattern '^[A-Z_]', eslint.config.js:26), así que el error se va sin desactivar nada y sin cambiar el comportamiento. Deja el import de getSidebarIconForNavItem. Los demás borrados de la §3 (profile y enrichedCompany en CompaniesViewPage y CompanyEditLayout, companyId en DocumentBuilderPreviewPage, supplierTypeLabel) sí van: aparecen solo en su propia declaración.
- **Motivo del Arquitecto:** El prompt de Ignacio (docs/disenos/prompts/lint-frontend-cero.md) se contradice en este caso. En la línea 49 manda borrar la asignación de `navIcon` en AppSubHeader.jsx:48, incluida la llamada a `getSidebarIconForNavItem`. En las líneas 24-25 y en el proposal dice que el comportamiento no cambia. `navIcon` sí se usa en el JSX (`<navIcon.Component />`, línea 77): si se borra, o se rompe el render o desaparece el ícono. ESLint lo marca solo porque `frontend/eslint.config.js` no incluye `eslint-plugin-react`, y `package.json` no se puede tocar. La salida de la opción 1 es un `eslint-disable-next-line` que no está en la tabla de desactivaciones del prompt (líneas 60-71), y el prompt dice "se usa tal cual… no se reinterpreta". Resolverlo es interpretar el prompt frente a su propio objetivo: atribución 9 (el diseño), que le toca a Ignacio. No hay precedente en main ni decisión previa en esta corrida que lo cubra.
- **Fecha:** 2026-09-28T22:10:32.797Z
