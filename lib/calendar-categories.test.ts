import { describe, it, expect } from 'vitest'
import {
  getCalendarCategory,
  getCategoryColorClasses,
  getCategoryLabel,
  ALL_CALENDAR_CATEGORIES,
} from './calendar-categories'

describe('getCalendarCategory', () => {
  it('maps known auto_source values to their category', () => {
    expect(getCalendarCategory('registration_deadline')).toBe('registration_deadline')
    expect(getCalendarCategory('submission_deadline')).toBe('submission_deadline')
    expect(getCalendarCategory('event_start_at')).toBe('event_start_at')
    expect(getCalendarCategory('event_end_at')).toBe('event_end_at')
  })

  it('maps null (manual items) to manual', () => {
    expect(getCalendarCategory(null)).toBe('manual')
  })

  it('maps unrecognized values to manual as a safe fallback', () => {
    expect(getCalendarCategory('something_new')).toBe('manual')
  })
})

describe('getCategoryColorClasses', () => {
  it('returns dot/badge classes for every category', () => {
    for (const category of ALL_CALENDAR_CATEGORIES) {
      const classes = getCategoryColorClasses(category)
      expect(classes.dot).toBeTruthy()
      expect(classes.badgeBg).toBeTruthy()
      expect(classes.badgeText).toBeTruthy()
    }
  })

  it('gives each category a visually distinct dot color', () => {
    const dots = ALL_CALENDAR_CATEGORIES.map((c) => getCategoryColorClasses(c).dot)
    expect(new Set(dots).size).toBe(ALL_CALENDAR_CATEGORIES.length)
  })
})

describe('getCategoryLabel', () => {
  it('returns a human-readable label for every category', () => {
    expect(getCategoryLabel('registration_deadline')).toBe('Registration deadline')
    expect(getCategoryLabel('submission_deadline')).toBe('Submission deadline')
    expect(getCategoryLabel('event_start_at')).toBe('Event starts')
    expect(getCategoryLabel('event_end_at')).toBe('Event ends')
    expect(getCategoryLabel('manual')).toBe('Manual / custom')
  })
})


