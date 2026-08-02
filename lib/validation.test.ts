import { describe, it, expect } from 'vitest'
import { competitionSchema } from './validation'

describe('competitionSchema', () => {
  it('accepts a minimal valid competition', () => {
    const result = competitionSchema.safeParse({ name: 'BYTESFEST 2026', tags: [] })
    expect(result.success).toBe(true)
  })

  it('transforms empty date/text strings to null to prevent postgres timestamp errors', () => {
    const result = competitionSchema.safeParse({
      name: 'BYTESFEST 2026',
      registration_deadline: '',
      submission_deadline: '',
      organizer: '',
      tags: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.registration_deadline).toBeNull()
      expect(result.data.submission_deadline).toBeNull()
      expect(result.data.organizer).toBeNull()
    }
  })

  it('rejects an empty name', () => {
    const result = competitionSchema.safeParse({ name: '', tags: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed instagram_url', () => {
    const result = competitionSchema.safeParse({
      name: 'X', tags: [], instagram_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid instagram.com url', () => {
    const result = competitionSchema.safeParse({
      name: 'X', tags: [], instagram_url: 'https://instagram.com/bytesfest',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an instagram_url on the wrong domain', () => {
    const result = competitionSchema.safeParse({
      name: 'X', tags: [], instagram_url: 'https://example.com/bytesfest',
    })
    expect(result.success).toBe(false)
  })
})
