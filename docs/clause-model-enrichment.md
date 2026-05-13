# Clause Model Enrichment Documentation

## Overview

This document describes the changes made to the clause data model to support rich content from TipTap editor, status management, and authorship tracking.

## Schema Changes

### Table: clause

Added fields to support rich content and metadata:

| Field | Type | Description | Default | Constraints |
|--------|------|-------------|-----------|--------------|
| title_clause | VARCHAR(255) | Clause title | NULL |
| code | VARCHAR(100) | Clause code | NULL |
| description | TEXT | Clause description | NULL |
| content_json | JSONB | TipTap editor content | NULL |
| status | clause_status ENUM | Clause status | 'draft' |
| created_by | UUID FK | Author user | NOT NULL, FK user_profile |
| updated_by | UUID FK | Last updater | NULL, FK user_profile |
| last_edited_by | UUID FK | Last editor | NULL, FK user_profile |

### Table: clause_universal

Added field for global uniqueness:

| Field | Type | Description | Constraints |
|--------|------|-------------|--------------|
| code | VARCHAR(100) | Clause code | UNIQUE, NOT NULL |

### Table: clause_company

Added field for company-scoped uniqueness:

| Field | Type | Description | Constraints |
|--------|------|-------------|--------------|
| code | VARCHAR(100) | Clause code | UNIQUE(company_id, code), NOT NULL |

## New ENUM Type

```sql
CREATE TYPE clause_status AS ENUM ('draft', 'active', 'inactive')
```

## Indexes Added

### Performance Indexes

- `idx_clause_status` - For filtering by status
- `idx_clause_created_by` - For filtering by author
- `idx_clause_updated_by` - For filtering by updater
- `idx_clause_last_edited_by` - For filtering by last editor

### Uniqueness Indexes

- `idx_clause_universal_code` - Unique constraint on clause_universal.code
- `idx_clause_company_code` - Unique constraint on clause_company(company_id, code)

### JSON Index

- `idx_clause_content_json_gin` - GIN index for JSONB content queries

## Migration Details

### Migration File
- `202604160005_enrich_clause_model.js`

### Rollback Support
- Complete rollback function included
- Removes all indexes, constraints, and fields in reverse order
- Drops ENUM type

## Data Migration Strategy

### Existing Data
- All existing clauses get `status = 'draft'`
- `content_json` remains NULL for existing clauses
- Author fields populated with admin user from seeds

### New Seeds
- `011_enriched_clause_seed.js` updates existing clauses with:
  - Meaningful titles and codes
  - Sample TipTap JSON content
  - Proper author relationships

## Validation Criteria

### Uniqueness Constraints
- Universal clauses: Global code uniqueness
- Company clauses: Code uniqueness per company
- Maintains inheritance structure

### Data Integrity
- Foreign keys to user_profile with proper constraints
- Status limited to defined ENUM values
- JSON content properly indexed for performance

### Performance
- Indexes for common query patterns
- GIN index for JSON content searches
- Optimized for clause listing and filtering

## Usage Examples

### Querying Clauses by Status
```sql
SELECT * FROM clause WHERE status = 'active';
-- Uses idx_clause_status
```

### Searching JSON Content
```sql
SELECT * FROM clause WHERE content_json @> '{"type": "variable"}';
-- Uses idx_clause_content_json_gin
```

### Checking Code Availability
```sql
-- Universal clause
SELECT COUNT(*) FROM clause_universal WHERE code = 'MY_CODE';

-- Company clause  
SELECT COUNT(*) FROM clause_company 
WHERE company_id = $1 AND code = 'MY_CODE';
```

## Future Considerations

- Template usage validation for active clauses
- Audit trail for status changes
- Content versioning if needed
- Performance monitoring as data grows
