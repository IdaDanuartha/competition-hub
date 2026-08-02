import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, isWithinDays } from './date-format'

describe('formatDate', () => {
  it('formats an ISO string as a short date', () => {
    expect(formatDate('2026-08-15T00:00:00Z')).toBe('Aug 15, 2026')
  })
  it('returns a dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('formats an ISO string with time', () => {
    expect(formatDateTime('2026-08-15T09:30:00Z')).toContain('2026')
  })
})

describe('isWithinDays', () => {
  it('is true for a date 2 days from now within a 3 day window', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(isWithinDays(soon, 3)).toBe(true)
  })
  it('is false for a date 10 days from now within a 3 day window', () => {
    const far = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(isWithinDays(far, 3)).toBe(false)
  })
  it('is false for null', () => {
    expect(isWithinDays(null, 3)).toBe(false)
  })
})
