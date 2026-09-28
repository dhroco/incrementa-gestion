# pasted-plain-text-control-chars Specification

## Purpose
TBD - created by archiving change lint-frontend-cero. Update Purpose after archive.

## Requirements
### Requirement: Control characters are removed from pasted plain text

`sanitizePastedPlainText` MUST remove the control characters U+0000, U+0007, U+001F, and U+007F from the input. Other characters in the same string MUST stay, in the same order. The removal MUST keep using the existing control-character replacement; that expression MUST NOT change.

#### Scenario: Controls between letters are stripped

- **WHEN** `sanitizePastedPlainText` receives `a\u0000b\u0007c\u001Fd\u007Fe`
- **THEN** the result is `abcde`

### Requirement: Line breaks are preserved and vertical tab and form feed become newlines

`sanitizePastedPlainText` MUST keep a line feed (`\n`). It MUST turn a vertical tab (`\v`) and a form feed (`\f`) into a line feed. That conversion MUST run before the control-character removal, as it does today.

#### Scenario: Newline stays and vertical tab and form feed become newlines

- **WHEN** `sanitizePastedPlainText` receives `línea\nvertical\vform\ffinal`
- **THEN** the result is `línea\nvertical\nform\nfinal`

### Requirement: Plain text is unchanged

`sanitizePastedPlainText` MUST return a string with no special characters as the same string. Leading and trailing spaces are outside this requirement; the input MUST NOT rely on `trim()`.

#### Scenario: Text without special characters is returned as is

- **WHEN** `sanitizePastedPlainText` receives `Contrato vigente`
- **THEN** the result is `Contrato vigente`
