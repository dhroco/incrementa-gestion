# contract-signature-block Specification

## Purpose
Nodo Tiptap `signatureBlock` que envuelve los párrafos de firma existentes, se renderiza en PDF con ranura de imagen opcional, y se aplica a las plantillas activas sin reescribir el texto.

## Requirements
### Requirement: Tiptap signatureBlock wraps existing paragraphs

The document model SHALL include a block node `signatureBlock` with attributes `party` (exactly `"company"` or `"supplier"`) and `repIndex` (`1`, `2`, or `null`). The node's content SHALL be the same paragraph nodes that previously sat at that position in the template (underscore line, name line, optional `p.p.` line). The node SHALL NOT replace those paragraphs with `name`/`subtitle` attributes.

Variable substitution SHALL continue to walk `variable` nodes inside the wrap; it SHALL NOT read signature identity from node attributes.

#### Scenario: Company representative 1 block

- **WHEN** a `signatureBlock` has `party` `"company"` and `repIndex` `1`
- **AND** its content includes a paragraph with variable `company_legal_rep1_name`
- **THEN** substitution still resolves that variable from company data
- **AND** the paragraph text after substitution is unchanged versus the unwrapped template

#### Scenario: Supplier block

- **WHEN** a `signatureBlock` has `party` `"supplier"` and `repIndex` `null`
- **AND** its content includes a paragraph with variable `proveedor_nombre`
- **THEN** substitution still resolves that variable from supplier data
- **AND** the supplier signature line remains an empty underscore paragraph (no image in this change)

### Requirement: PDF render without image is identical to unwrapped paragraphs

When `buildPdfBytesFromTipTapWithReactPdf` receives a `signatureBlock` and no matching buffer in `signatureImages`, it SHALL render the inner paragraphs with the same typography as today. The wrapping `View` SHALL NOT reserve height for an image slot. Extracted text and page count SHALL match a control document whose `doc.content` is those same paragraphs without the wrap (fixture not sitting on a page break).

#### Scenario: Empty slot adds no height or pages

- **WHEN** a fixture of signature paragraphs is rendered once unwrapped and once wrapped in `signatureBlock` with `signatureImages` omitted or empty
- **THEN** extracted PDF text is identical
- **AND** page count is identical
- **AND** the wrap does not insert a blank band above the underscore line

### Requirement: Optional image slot above the first child

When a buffer is supplied for the block's `party` and `repIndex`, the renderer SHALL draw an `Image` from `@react-pdf/renderer` above the first content child. The image SHALL use fixed height 38 pt, `objectFit` `contain`, max width 160 pt, and horizontal alignment inherited from the first child's `blockAlign` (left/center/right/justify).

The renderer SHALL accept `buildPdfBytesFromTipTapWithReactPdf(doc, { signatureImages })` where keys are `company:1`, `company:2`, and `supplier`. The image SHALL NOT be stored as a Tiptap node.

#### Scenario: Company image sits on the line

- **WHEN** `signatureImages['company:1']` is a PNG buffer
- **AND** the doc contains `signatureBlock` `party` `"company"` `repIndex` `1`
- **THEN** the PDF includes that image in the company block
- **AND** the inner paragraph text is still present below the image

#### Scenario: Supplier block ignores company image

- **WHEN** only `signatureImages['company:1']` is provided
- **THEN** a `party` `"supplier"` block renders with no image slot height

### Requirement: Signature block does not split across pages

The wrapping `View` SHALL set `wrap={false}` so the image slot (if any) and all inner paragraphs stay on one page.

#### Scenario: Block at the page footer

- **WHEN** filler paragraphs push a `signatureBlock` to the point where it would split across a page boundary
- **THEN** the extracted text of the first inner paragraph and of the last inner paragraph appear on the same page

### Requirement: Renderer does not access the network

`documentBuilderTipTapReactPdf.js` SHALL NOT import GCS, `https`, or `fetch`. Image bytes SHALL be passed in as already-downloaded `Buffer`s.

#### Scenario: Render with injected buffer

- **WHEN** the renderer is called with a PNG `Buffer` in `signatureImages`
- **THEN** it produces a PDF without performing any network I/O

### Requirement: Re-render is deterministic on text and page count

Rendering the same Tiptap snapshot twice with the same `signatureImages` map SHALL produce the same extracted text and the same page count. Byte-for-byte PDF equality is NOT required.

#### Scenario: Two renders of one snapshot

- **WHEN** `buildPdfBytesFromTipTapWithReactPdf` is invoked twice with the identical `doc` and `signatureImages`
- **THEN** extracted text is equal
- **AND** page count is equal

### Requirement: Template editor round-trips signatureBlock

The Tiptap editor used for standard templates SHALL register a `signatureBlock` extension so that loading and saving JSON preserves the wrap and its attributes. Unknown-node stripping SHALL NOT occur for this type.

#### Scenario: Save does not unwrap

- **WHEN** a template whose `content_json` contains `signatureBlock` is loaded in the editor and saved without edits
- **THEN** the persisted JSON still contains `signatureBlock` with the same `party`, `repIndex`, and inner paragraphs

### Requirement: Active templates are wrapped without rewriting copy

A one-shot idempotent script SHALL wrap canonical signature paragraph groups in the 17 **active** templates only. Inactive templates (PL0001–PL0004) SHALL NOT be modified.

Before the first mutation of a template, the script SHALL insert its current `content_json` into `template_content_backup` with `note` `'pre-firma-escrita-bloque-firma'` (creating that table via migration if it does not exist). Groups that already are `signatureBlock` SHALL be left unchanged.

Attribute assignment SHALL be: variable `company_legal_rep1_name` → `party` `"company"` `repIndex` `1`; `company_legal_rep2_name` → `party` `"company"` `repIndex` `2`; `proveedor_nombre` → `party` `"supplier"` `repIndex` `null`.

Groups that do not match the canonical pattern (underscore paragraph + name paragraph with one of those variables + optional `p.p.` paragraph) SHALL NOT be guessed. The script SHALL report each unmatched active template by `code` and reason, leave its `content_json` unchanged, and those SHALL be wrapped by hand.

#### Scenario: Canonical Chilean company block is wrapped

- **WHEN** an active template has consecutive paragraphs matching the canonical pattern around `company_legal_rep1_name`
- **THEN** those paragraphs become the content of one `signatureBlock` with `party` `"company"` and `repIndex` `1`
- **AND** a backup row exists with `note` `'pre-firma-escrita-bloque-firma'`

#### Scenario: Non-matching template is reported not mutated

- **WHEN** an active template's signature region does not match the canonical pattern
- **THEN** the script prints that template's `code` and the mismatch reason
- **AND** `content_json` is not updated
- **AND** a backup row is still written before the scan if this was the first run

#### Scenario: Second run is a no-op on already wrapped templates

- **WHEN** the script runs again against a template already wrapped
- **THEN** it does not duplicate `signatureBlock`
- **AND** it does not insert a second backup with the same `note` for that template
