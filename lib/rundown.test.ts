import { describe, it, expect } from 'vitest'
import { detectDeadlineOverlaps } from './rundown'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? 'x',
    user_id: 'u',
    name: overrides.name ?? 'Comp',
    organizer: null,
    theme: null,
    status: 'registered',
    team_name: null,
    instagram_url: null,
    website_url: null,
    registration_deadline: null,
    submission_deadline: null,
    event_start_at: null,
    event_end_at: null,
    location: null,
    tags: [],
    cloned_from_id: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('detectDeadlineOverlaps', () => {
  it('flags two competitions with submission deadlines 1 day apart', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', name: 'A', submission_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', name: 'B', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() })
    const overlaps = detectDeadlineOverlaps([a, b])
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].competitionIds.sort()).toEqual(['a', 'b'])
  })

  it('does not flag deadlines 5 days apart', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', submission_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', submission_deadline: new Date(base + 5 * 24 * 60 * 60 * 1000).toISOString() })
    expect(detectDeadlineOverlaps([a, b])).toHaveLength(0)
  })

  it('excludes completed and not_selected competitions', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', status: 'completed', submission_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() })
    expect(detectDeadlineOverlaps([a, b])).toHaveLength(0)
  })

  it('compares registration and submission deadlines across competitions too', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', registration_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() })
    expect(detectDeadlineOverlaps([a, b])).toHaveLength(1)
  })
})
