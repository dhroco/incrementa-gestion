## MODIFIED Requirements

### Requirement: Supplier form section components

The frontend MUST export `SupplierBasicDataSection` containing the supplier type selector and all type-dependent fields (persona natural, empresa, representante legal, personería), and `SupplierSocialNetworksSection` containing exclusively the social networks UI via `SocialNetworkSelector`. Both sections MUST accept props: `form`, `readOnly`, `fieldErrors`, and for the social networks section a single `onSocialNetworksChange` callback (replacing per-row handlers `onSocialNetworkChange`, `onAddSocialNetwork`, `onRemoveSocialNetwork`). `SupplierBasicDataSection` MUST continue to accept `onChange`, `typeLocked`, and `fieldErrors`.

#### Scenario: Basic data section renders type-specific fields

- **WHEN** supplier type is `empresa` in create mode
- **THEN** `SupplierBasicDataSection` shows empresa fields and hides persona natural-only fields

#### Scenario: Social networks section uses catalog selector

- **WHEN** `SupplierSocialNetworksSection` renders in edit mode
- **THEN** it renders `SocialNetworkSelector` instead of an editable table with network name dropdown
- **AND** no "Agregar red social" row-add button is shown

#### Scenario: Social networks section is isolated

- **WHEN** either section is rendered independently
- **THEN** social network selection appears only in `SupplierSocialNetworksSection`
