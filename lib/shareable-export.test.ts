import { describe, it, expect } from 'vitest'
import { generateShareableBrief } from './shareable-export'
import type { Competition, AiSummary } from '@/lib/types/database'

const mockComp: Competition = {
  id: 'c1', user_id: 'u1', name: 'BYTESFEST 2026', organizer: 'UNS', theme: 'AI Solution',
  status: 'registered', team_name: 'REGEX', team_members: ['Danu', 'I Ketut Yogi'],
  instagram_url: 'https://instagram.com/bytesfest', website_url: 'https://bytesfest.com',
  registration_deadline: '2026-08-15T23:59:00Z', submission_deadline: '2026-09-01T23:59:00Z',
  event_start_at: null, event_end_at: null, location: 'Solo', tags: ['hackathon'],
  cloned_from_id: null, notes: null, created_at: '', updated_at: ''
}

const mockSummary: AiSummary = {
  id: 's1', competition_id: 'c1', summary: 'AI Innovation competition.',
  key_requirements: ['Max 3 members'], important_dates: ['Submission: Sept 1'],
  judging_criteria: ['Innovation (50%)'], theme_and_subtheme: 'AI & Web',
  project_idea_suggestions: [{ title: 'Idea A', description: 'Smart assistant', rationale: 'High scoring potential' }],
  model_used: 'gemini-2.5-flash', created_at: '', updated_at: ''
}

describe('generateShareableBrief', () => {
  it('formats competition info and AI advice into a clean Markdown brief', () => {
    const brief = generateShareableBrief(mockComp, mockSummary)
    expect(brief).toContain('BYTESFEST 2026')
    expect(brief).toContain('Team: REGEX (Danu, I Ketut Yogi)')
    expect(brief).toContain('AI Innovation competition.')
    expect(brief).toContain('Idea A: Smart assistant')
    expect(brief).toContain('https://bytesfest.com')
  })
})
