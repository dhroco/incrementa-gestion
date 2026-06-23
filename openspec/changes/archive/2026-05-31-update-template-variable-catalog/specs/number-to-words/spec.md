## ADDED Requirements

### Requirement: Integer to Spanish words conversion

The backend MUST provide `numberToWords(n)` in `backend/utils/numberToWords.js` that converts a non-negative integer to words in Spanish without currency suffix. The function MUST handle:

- 0–19: cero, uno, dos, …, diecinueve
- 20–29: veinte, veintiuno, …, veintinueve (compound form, not "veinte y uno")
- 30–99: treinta, treinta y uno, …, noventa y nueve
- 100: "cien"; 101–199: "ciento uno" … "ciento noventa y nueve"
- 200–999: doscientos, trescientos, cuatrocientos, quinientos, seiscientos, setecientos, ochocientos, novecientos
- 1.000: "mil" (not "un mil"); multiples: "dos mil", etc.
- 1.000.000: "un millón"; multiples: "dos millones", etc.
- Combinations: 1.500.000 → "un millón quinientos mil"; 2.350.000 → "dos millones trescientos cincuenta mil"

The function MUST use "un" before "millón" and "mil" when appropriate, but "uno" when standalone. It MUST use "cien" for exactly 100 and "ciento" when a remainder exists. Masculine generic form is sufficient; feminine is not required.

#### Scenario: Zero returns cero

- **WHEN** `numberToWords(0)` is called
- **THEN** it returns `"cero"`

#### Scenario: Compound twenties

- **WHEN** `numberToWords(21)` is called
- **THEN** it returns `"veintiuno"`

#### Scenario: Hundred boundary

- **WHEN** `numberToWords(100)` is called
- **THEN** it returns `"cien"`

#### Scenario: Hundred with remainder

- **WHEN** `numberToWords(101)` is called
- **THEN** it returns `"ciento uno"`

#### Scenario: Million combination

- **WHEN** `numberToWords(1500000)` is called
- **THEN** it returns `"un millón quinientos mil"`

#### Scenario: Large combination

- **WHEN** `numberToWords(2350000)` is called
- **THEN** it returns `"dos millones trescientos cincuenta mil"`

### Requirement: Price text auto-generation uses numberToWords

When `generateAndPersist` preprocesses `missingFieldOverrides` and `precio_numero` is present, the service MUST set `precio_texto` to `numberToWords(parsedInteger)` regardless of any user-supplied `precio_texto` value.

#### Scenario: Price override generates text

- **WHEN** generation receives `missingFieldOverrides: { precio_numero: '1500000' }`
- **THEN** the substitution map includes `precio_texto` equal to `"un millón quinientos mil"`
