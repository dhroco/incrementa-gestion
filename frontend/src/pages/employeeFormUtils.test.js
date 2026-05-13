import { describe, expect, it } from 'vitest'
import {
  formatEsDateFromIso,
  joinPartsToIsoOrNull,
  normalizeIsoDateOrNull,
  splitIsoDateToParts
} from './employeeFormUtils.js'

describe('employeeFormUtils', () => {
  it('splits and joins ISO date', () => {
    expect(splitIsoDateToParts('1990-03-15')).toEqual({ y: '1990', m: '03', d: '15' })
    expect(joinPartsToIsoOrNull('15', '3', '1990')).toBe('1990-03-15')
  })
  it('joins null for incomplete', () => {
    expect(joinPartsToIsoOrNull('15', '', '1990')).toBeNull()
  })
  it('normalizes full ISO date string', () => {
    expect(normalizeIsoDateOrNull('1990-05-20')).toBe('1990-05-20')
    expect(normalizeIsoDateOrNull('1990-05-20T00:00:00.000Z')).toBe('1990-05-20')
    expect(normalizeIsoDateOrNull('')).toBeNull()
    expect(normalizeIsoDateOrNull('1990-13-01')).toBeNull()
  })
  it('formats for display in es-CL', () => {
    expect(formatEsDateFromIso('1990-03-15')).not.toBe('—')
  })
})
