import { describe, expect, it } from 'vitest'
import { auditPersonLabel, formatAuditDateTime, listRowLastEditorLabel } from './auditMetadataDisplay'

describe('formatAuditDateTime', () => {
  it('returns dash for empty', () => {
    expect(formatAuditDateTime(null)).toBe('—')
    expect(formatAuditDateTime(undefined)).toBe('—')
  })

  it('formats ISO string without throwing', () => {
    const s = formatAuditDateTime('2026-04-22T12:00:00.000Z')
    expect(s).not.toBe('—')
    expect(s.length).toBeGreaterThan(4)
  })
})

describe('auditPersonLabel', () => {
  it('prefers name', () => {
    expect(auditPersonLabel('Ana Pérez', 'uuid')).toBe('Ana Pérez')
  })

  it('falls back to id prefix', () => {
    expect(auditPersonLabel(null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toMatch(/^Perfil aaaaaaaa/)
  })

  it('returns dash when missing', () => {
    expect(auditPersonLabel(null, null)).toBe('—')
  })
})

describe('listRowLastEditorLabel', () => {
  it('prefers last_editor_display', () => {
    expect(listRowLastEditorLabel({ last_editor_display: '  Ana  ' })).toBe('Ana')
  })

  it('falls back to last_edited_by id when names missing', () => {
    expect(
      listRowLastEditorLabel({
        last_edited_by: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      })
    ).toMatch(/^Perfil aaaaaaaa/)
  })

  it('falls back to updated_by when last_edited empty', () => {
    expect(
      listRowLastEditorLabel({
        last_edited_by: null,
        last_edited_by_name: null,
        updated_by_name: 'Luis',
      })
    ).toBe('Luis')
  })
})
