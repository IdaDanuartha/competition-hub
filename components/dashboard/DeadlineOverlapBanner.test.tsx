import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeadlineOverlapBanner } from './DeadlineOverlapBanner'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: overrides.name ?? 'Comp', organizer: null, theme: null,
    status: overrides.status ?? 'registered', team_name: null, instagram_url: null, website_url: null,
    registration_deadline: null, submission_deadline: overrides.submission_deadline ?? null,
    event_start_at: null, event_end_at: null, location: null, tags: [], cloned_from_id: null,
    notes: null, created_at: '', updated_at: '', ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('DeadlineOverlapBanner', () => {
  it('shows a banner naming both competitions when deadlines overlap within 3 days', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const rows = [
      comp({ id: 'a', name: 'BYTESFEST', submission_deadline: new Date(base).toISOString() }),
      comp({ id: 'b', name: 'Hackalab', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() }),
    ]
    render(<DeadlineOverlapBanner competitions={rows} />)
    expect(screen.getByText(/BYTESFEST/)).toBeInTheDocument()
    expect(screen.getByText(/Hackalab/)).toBeInTheDocument()
  })

  it('renders nothing when there is no overlap', () => {
    const rows = [comp({ id: 'a', submission_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() })]
    const { container } = render(<DeadlineOverlapBanner competitions={rows} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides a dismissed pair and persists the dismissal across remounts', async () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const rows = [
      comp({ id: 'a', name: 'BYTESFEST', submission_deadline: new Date(base).toISOString() }),
      comp({ id: 'b', name: 'Hackalab', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() }),
    ]
    const { unmount } = render(<DeadlineOverlapBanner competitions={rows} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/BYTESFEST/)).not.toBeInTheDocument()
    unmount()
    render(<DeadlineOverlapBanner competitions={rows} />)
    expect(screen.queryByText(/BYTESFEST/)).not.toBeInTheDocument()
  })
})
