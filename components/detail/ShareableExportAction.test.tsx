import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareableExportAction } from './ShareableExportAction'
import type { Competition, AiSummary } from '@/lib/types/database'

const mockComp: Competition = {
  id: 'c1', user_id: 'u1', name: 'BYTESFEST', organizer: 'UNS', theme: 'AI',
  status: 'registered', team_name: 'REGEX', instagram_url: null, website_url: null,
  registration_deadline: null, submission_deadline: null, event_start_at: null,
  event_end_at: null, location: null, tags: [], cloned_from_id: null, notes: null,
  created_at: '', updated_at: ''
}

describe('ShareableExportAction', () => {
  it('renders copy brief button', async () => {
    render(<ShareableExportAction competition={mockComp} summary={null} />)
    expect(screen.getByRole('button', { name: /share brief/i })).toBeInTheDocument()
  })
})
